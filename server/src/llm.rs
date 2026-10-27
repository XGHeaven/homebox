use actix_web::{http::StatusCode, web, HttpRequest, HttpResponse};
use futures::StreamExt;
use serde::Deserialize;
use std::time::Duration;

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Openai,
    Anthropic,
    Ollama,
}

#[derive(Deserialize)]
pub struct LlmRequest {
    url: String,
    protocol: Protocol,
    key: String,
    body: serde_json::Value,
    timeout_seconds: u64,
}

pub fn client() -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        // Never forward credentials to a redirect destination.
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(15))
        .build()
}

fn validated_url(req: &HttpRequest, endpoint: &str) -> Result<reqwest::Url, HttpResponse> {
    // Cross-origin pages cannot send this header: this endpoint has no CORS preflight support.
    if req
        .headers()
        .get("x-homebox-llm")
        .and_then(|v| v.to_str().ok())
        != Some("1")
    {
        return Err(HttpResponse::Forbidden().finish());
    }
    let url = match reqwest::Url::parse(endpoint) {
        Ok(url)
            if matches!(url.scheme(), "http" | "https")
                && url.host_str().is_some()
                && url.username().is_empty()
                && url.password().is_none()
                && url.fragment().is_none() =>
        {
            url
        }
        _ => return Err(HttpResponse::BadRequest().body("Invalid endpoint")),
    };
    Ok(url)
}

fn authenticate(
    mut request: reqwest::RequestBuilder,
    protocol: &Protocol,
    key: &str,
) -> reqwest::RequestBuilder {
    match protocol {
        Protocol::Anthropic => {
            request = request.header("anthropic-version", "2023-06-01");
            if !key.is_empty() {
                request = request.header("x-api-key", key);
            }
        }
        _ => {
            if !key.is_empty() {
                request = request.bearer_auth(key);
            }
        }
    }
    request
}

#[derive(Deserialize)]
pub struct ModelsRequest {
    url: String,
    protocol: Protocol,
    key: String,
}

pub async fn models(
    req: HttpRequest,
    input: web::Json<ModelsRequest>,
    client: web::Data<reqwest::Client>,
) -> HttpResponse {
    let url = match validated_url(&req, &input.url) {
        Ok(url) => url,
        Err(response) => return response,
    };
    let request = authenticate(
        client.get(url).timeout(Duration::from_secs(20)),
        &input.protocol,
        &input.key,
    );
    let response = match request.send().await {
        Ok(response) => response,
        Err(error) => {
            return if error.is_timeout() {
                HttpResponse::GatewayTimeout().finish()
            } else {
                HttpResponse::BadGateway().finish()
            }
        }
    };
    let status =
        StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    if !status.is_success() {
        return HttpResponse::build(if status.is_redirection() {
            StatusCode::BAD_GATEWAY
        } else {
            status
        })
        .finish();
    }
    let mut stream = response.bytes_stream();
    let mut body = Vec::new();
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(chunk) if body.len() + chunk.len() <= 4 * 1024 * 1024 => {
                body.extend_from_slice(&chunk)
            }
            _ => return HttpResponse::BadGateway().finish(),
        }
    }
    match serde_json::from_slice::<serde_json::Value>(&body) {
        Ok(value) => HttpResponse::Ok()
            .insert_header(("Cache-Control", "no-store"))
            .json(value),
        Err(_) => HttpResponse::BadGateway().finish(),
    }
}

pub async fn proxy(
    req: HttpRequest,
    input: web::Json<LlmRequest>,
    client: web::Data<reqwest::Client>,
) -> HttpResponse {
    let url = match validated_url(&req, &input.url) {
        Ok(url) => url,
        Err(response) => return response,
    };
    if !(1..=600).contains(&input.timeout_seconds)
        || input.body.get("stream") != Some(&serde_json::json!(true))
    {
        return HttpResponse::BadRequest().body("Invalid streaming request or timeout");
    }
    let mut request = client
        .post(url)
        .header("accept-encoding", "identity")
        .timeout(Duration::from_secs(input.timeout_seconds))
        .json(&input.body);
    request = authenticate(request, &input.protocol, &input.key);
    let response = match request.send().await {
        Ok(response) => response,
        Err(error) => {
            return if error.is_timeout() {
                HttpResponse::GatewayTimeout().finish()
            } else {
                // Reqwest errors may contain URLs and credentials. Do not expose them.
                HttpResponse::BadGateway().finish()
            };
        }
    };
    let status =
        StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    if !status.is_success() {
        return HttpResponse::build(if status.is_redirection() {
            StatusCode::BAD_GATEWAY
        } else {
            status
        })
        .finish();
    }
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_owned();
    HttpResponse::Ok()
        .content_type(content_type)
        .insert_header(("Cache-Control", "no-store, no-transform"))
        .insert_header(("X-Accel-Buffering", "no"))
        .streaming(response.bytes_stream().map(|chunk| {
            chunk.map_err(|_| actix_web::error::ErrorBadGateway("Upstream stream failed"))
        }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{test, App, HttpServer};

    #[actix_web::test]
    async fn model_lookup_uses_get_auth_and_rejects_redirects() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = HttpServer::new(|| {
            App::new()
                .route(
                    "/models",
                    web::get().to(|req: HttpRequest| async move {
                        assert_eq!(
                            req.headers().get("authorization").unwrap(),
                            "Bearer test-key"
                        );
                        HttpResponse::Ok().json(serde_json::json!({"data":[{"id":"test-model"}]}))
                    }),
                )
                .route(
                    "/anthropic",
                    web::get().to(|req: HttpRequest| async move {
                        assert_eq!(req.headers().get("x-api-key").unwrap(), "test-key");
                        assert_eq!(
                            req.headers().get("anthropic-version").unwrap(),
                            "2023-06-01"
                        );
                        HttpResponse::Ok().json(serde_json::json!({"data":[]}))
                    }),
                )
                .route(
                    "/redirect",
                    web::get().to(|| async {
                        HttpResponse::TemporaryRedirect()
                            .insert_header(("Location", "/models"))
                            .finish()
                    }),
                )
                .route(
                    "/invalid",
                    web::get().to(|| async { HttpResponse::Ok().body("not JSON") }),
                )
        })
        .listen(listener)
        .unwrap()
        .run();
        let handle = server.handle();
        actix_web::rt::spawn(server);
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(client().unwrap()))
                .route("/api/llm/models", web::post().to(models)),
        )
        .await;
        for (path, protocol, expected) in [
            ("models", "openai", 200),
            ("anthropic", "anthropic", 200),
            ("redirect", "openai", 502),
            ("invalid", "ollama", 502),
        ] {
            let req = test::TestRequest::post().uri("/api/llm/models").insert_header(("x-homebox-llm", "1"))
                .set_json(serde_json::json!({"url":format!("http://{address}/{path}"),"protocol":protocol,"key":"test-key"})).to_request();
            let response = test::call_service(&app, req).await;
            assert_eq!(response.status().as_u16(), expected);
            if expected == 200 {
                assert_eq!(response.headers().get("cache-control").unwrap(), "no-store");
            }
        }
        let req = test::TestRequest::post()
            .uri("/api/llm/models")
            .set_json(
                serde_json::json!({"url":"https://example.com", "protocol":"openai", "key":""}),
            )
            .to_request();
        assert_eq!(
            test::call_service(&app, req).await.status(),
            StatusCode::FORBIDDEN
        );
        handle.stop(false).await;
    }

    #[actix_web::test]
    async fn rejects_untrusted_or_invalid_requests() {
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(client().unwrap()))
                .route("/api/llm", web::post().to(proxy)),
        )
        .await;
        let payload = serde_json::json!({"url":"file:///tmp/test", "protocol":"openai", "key":"", "body":{"stream":true}, "timeout_seconds":10});
        let req = test::TestRequest::post()
            .uri("/api/llm")
            .set_json(&payload)
            .to_request();
        assert_eq!(
            test::call_service(&app, req).await.status(),
            StatusCode::FORBIDDEN
        );
        let req = test::TestRequest::post()
            .uri("/api/llm")
            .insert_header(("x-homebox-llm", "1"))
            .set_json(&payload)
            .to_request();
        assert_eq!(
            test::call_service(&app, req).await.status(),
            StatusCode::BAD_REQUEST
        );
    }

    #[actix_web::test]
    async fn forwards_auth_streams_and_does_not_follow_redirects() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = HttpServer::new(|| {
            App::new()
                .route(
                    "/chat",
                    web::post().to(
                        |req: HttpRequest, body: web::Json<serde_json::Value>| async move {
                            assert_eq!(
                                req.headers().get("authorization").unwrap(),
                                "Bearer test-key"
                            );
                            assert_eq!(body["stream"], true);
                            HttpResponse::Ok()
                                .content_type("text/event-stream")
                                .body("data: [DONE]\n\n")
                        },
                    ),
                )
                .route(
                    "/messages",
                    web::post().to(|req: HttpRequest| async move {
                        assert_eq!(req.headers().get("x-api-key").unwrap(), "test-key");
                        assert_eq!(
                            req.headers().get("anthropic-version").unwrap(),
                            "2023-06-01"
                        );
                        assert!(req.headers().get("authorization").is_none());
                        HttpResponse::Ok()
                            .content_type("text/event-stream")
                            .body("event: message_stop\n\n")
                    }),
                )
                .route(
                    "/redirect",
                    web::post().to(|| async {
                        HttpResponse::TemporaryRedirect()
                            .insert_header(("Location", "/chat"))
                            .finish()
                    }),
                )
        })
        .listen(listener)
        .unwrap()
        .run();
        let handle = server.handle();
        actix_web::rt::spawn(server);
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(client().unwrap()))
                .route("/api/llm", web::post().to(proxy)),
        )
        .await;
        for (path, protocol) in [
            ("chat", "openai"),
            ("messages", "anthropic"),
            ("redirect", "openai"),
        ] {
            let req = test::TestRequest::post().uri("/api/llm").insert_header(("x-homebox-llm", "1"))
                .set_json(serde_json::json!({"url":format!("http://{address}/{path}"),"protocol":protocol,"key":"test-key","body":{"stream":true},"timeout_seconds":5})).to_request();
            let response = test::call_service(&app, req).await;
            if path == "redirect" {
                assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
            } else {
                assert_eq!(response.status(), StatusCode::OK);
                assert_eq!(response.headers().get("x-accel-buffering").unwrap(), "no");
                assert!(!test::read_body(response).await.is_empty());
            }
        }
        handle.stop(false).await;
    }
}

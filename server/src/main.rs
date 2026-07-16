use actix_web::web::Bytes;
use actix_web::{
    get,
    http::{header::ContentType, Method},
    middleware, web, App, Error, HttpRequest, HttpResponse, HttpServer, Responder,
};
use clap::{command, Args, Parser, Subcommand};
use futures::{stream::iter, StreamExt};
use include_dir::{include_dir, Dir};
use mime_guess::mime;
use serde::Deserialize;
use std::{path::PathBuf, time::Duration};

const WRITE_PACK_SIZE: usize = 1 * 1024 * 1024;
const MAX_DOWNLOAD_CHUNK_SIZE: usize = 64 * 1024 * 1024;
const MAX_DOWNLOAD_TOTAL_SIZE: usize = 1024 * 1024 * 1024;

static STATIC: Dir = include_dir!("../build/static");

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Comamnds,
}

#[derive(Subcommand)]
enum Comamnds {
    Serve(ServeArgs),
}

#[derive(Args)]
struct ServeArgs {
    #[arg(long, help = "Port to listen")]
    port: Option<u16>,
    #[arg(long, help = "Host to listen")]
    host: Option<String>,
    #[arg(long, help = "Number of Actix workers (defaults to Actix auto-sizing)")]
    workers: Option<usize>,
    #[arg(
        long,
        help = "Maximum concurrent connections (defaults to Actix default)"
    )]
    max_connections: Option<usize>,
    #[arg(
        long,
        help = "Keep-alive timeout in seconds (defaults to Actix default)"
    )]
    keep_alive_secs: Option<u64>,
}

async fn ping_get() -> impl Responder {
    HttpResponse::Ok()
        .content_type(ContentType::json())
        .body("{\"message\": \"pong\"}")
}

async fn ping_head() -> impl Responder {
    HttpResponse::NoContent().finish()
}

#[derive(Deserialize)]
struct DownloadQuery {
    count: Option<String>,
    size: Option<String>,
}

async fn download(query: web::Query<DownloadQuery>) -> impl Responder {
    let count = query
        .count
        .clone()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(8);
    let size = query
        .size
        .clone()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(WRITE_PACK_SIZE);

    if size > MAX_DOWNLOAD_CHUNK_SIZE {
        return HttpResponse::BadRequest().body(format!(
            "size must be less than or equal to {MAX_DOWNLOAD_CHUNK_SIZE}"
        ));
    }

    if count.saturating_mul(size) > MAX_DOWNLOAD_TOTAL_SIZE {
        return HttpResponse::BadRequest().body(format!(
            "count * size must be less than or equal to {MAX_DOWNLOAD_TOTAL_SIZE}"
        ));
    }

    let chunk = Bytes::from(vec![0u8; size]);

    HttpResponse::Ok()
        .content_type("application/octet-stream")
        .append_header((
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0",
        ))
        .append_header(("Content-Disposition", "attachment; filename=random.dat"))
        .append_header(("Content-Transfer-Encoding", "binary"))
        .streaming(iter(0..count).map(move |_| Ok::<_, Error>(chunk.clone())))
}

async fn upload(mut body: web::Payload) -> impl Responder {
    while let Some(chunk) = body.next().await {
        if let Err(error) = chunk {
            return HttpResponse::BadRequest().body(format!("failed to read upload body: {error}"));
        }
    }
    HttpResponse::Ok().finish()
}

async fn upload_options() -> impl Responder {
    HttpResponse::Ok().body("")
}

#[get("/static/{filename:.*}")]
async fn static_resource(req: HttpRequest) -> impl Responder {
    let path: PathBuf = req.match_info().query("filename").parse().unwrap();
    let mime = mime_guess::from_path(&path);
    HttpResponse::Ok()
        .content_type(mime.first().unwrap_or(mime::TEXT_PLAIN))
        .body(STATIC.get_file(path.to_str().unwrap()).unwrap().contents())
}

#[get("/")]
async fn index() -> impl Responder {
    HttpResponse::Ok().content_type(ContentType::html()).body(
        STATIC
            .get_file("index.html")
            .unwrap()
            .contents_utf8()
            .unwrap(),
    )
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let cli = Cli::parse();

    match &cli.command {
        Comamnds::Serve(args) => {
            // OPTIMIZE: Configure worker count and connection pool for high throughput
            let server = HttpServer::new(|| {
                App::new()
                    .wrap(
                        middleware::DefaultHeaders::new().add(("Access-Control-Allow-Origin", "*")),
                    )
                    .route("/api/download", web::get().to(download))
                    .route("/download", web::get().to(download))
                    .route("/api/upload", web::post().to(upload))
                    .route("/upload", web::post().to(upload))
                    .route(
                        "/api/upload",
                        web::method(Method::OPTIONS).to(upload_options),
                    )
                    .route(
                        "/upload",
                        web::method(Method::OPTIONS).to(upload_options),
                    )
                    .route("/api/ping", web::get().to(ping_get))
                    .route("/ping", web::get().to(ping_get))
                    .route("/api/ping", web::head().to(ping_head))
                    .route("/ping", web::head().to(ping_head))
                    .service(static_resource)
                    .service(index)
            });

            let server = if let Some(workers) = args.workers {
                server.workers(workers)
            } else {
                server
            };

            let server = if let Some(max_connections) = args.max_connections {
                server.max_connections(max_connections)
            } else {
                server
            };

            let server = if let Some(keep_alive_secs) = args.keep_alive_secs {
                server.keep_alive(Duration::from_secs(keep_alive_secs))
            } else {
                server
            };

            let server_bind_address = format!(
                "{}:{}",
                args.host.clone().unwrap_or("0.0.0.0".into()),
                args.port.unwrap_or(3300)
            );

            println!("Starting server on {}", &server_bind_address);

            server.bind(server_bind_address)?.run().await
        }
    }
}

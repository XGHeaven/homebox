use actix_web::{
    get, http::header::ContentType, middleware, options, post, web, App, Error, HttpRequest,
    HttpResponse, HttpServer, Responder,
};
use clap::{command, Args, Parser, Subcommand};
use futures::{stream::poll_fn, task::Poll, StreamExt};
use include_dir::{include_dir, Dir};
use mime_guess::mime;
use serde::Deserialize;
use std::path::PathBuf;

const WRITE_PACK_SIZE: usize = 1 * 1024 * 1024;

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
}

#[get("/ping")]
async fn ping() -> impl Responder {
    HttpResponse::Ok()
        .content_type(ContentType::json())
        .body("{\"message\": \"pong\"}")
}

#[derive(Deserialize)]
struct DownloadQuery {
    count: Option<String>,
    size: Option<String>,
}

#[get("/download")]
async fn download(query: web::Query<DownloadQuery>) -> impl Responder {
    let mut count = query
        .count
        .clone()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(8);
    let size = query
        .size
        .clone()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(WRITE_PACK_SIZE);
    let vecs = vec![0; size];

    let stream = poll_fn(move |_| -> Poll<Option<Result<web::Bytes, Error>>> {
        if count > 0 {
            count -= 1;
            Poll::Ready(Some(Ok(web::Bytes::from(vecs.clone()))))
        } else {
            Poll::Ready(None)
        }
    });
    HttpResponse::Ok()
        .append_header((
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0",
        ))
        .append_header(("Content-Disposition", "attachment; filename=random.dat"))
        .append_header(("Content-Transfer-Encoding", "binary"))
        .streaming(stream)
}

#[post("/upload")]
async fn upload(mut body: web::Payload) -> impl Responder {
    while let Some(chunk) = body.next().await {
        let _ = chunk;
    }
    HttpResponse::Ok().finish()
}

#[options("/upload")]
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
            let server = HttpServer::new(|| {
                App::new()
                    .wrap(
                        middleware::DefaultHeaders::new().add(("Access-Control-Allow-Origin", "*")),
                    )
                    .service(download)
                    .service(upload)
                    .service(upload_options)
                    .service(ping)
                    .service(static_resource)
                    .service(index)
            });

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

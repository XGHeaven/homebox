use actix_web::web::Bytes;
use actix_web::{
    get, head, http::header::ContentType, middleware, options, post, web, App, Error, HttpRequest,
    HttpResponse, HttpServer, Responder,
};
use clap::{command, Args, Parser, Subcommand};
use futures::{stream::iter, StreamExt};
use include_dir::{include_dir, Dir};
use mime_guess::mime;
use serde::Deserialize;
use std::{path::PathBuf, time::Duration};

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
async fn ping_get() -> impl Responder {
    HttpResponse::Ok()
        .content_type(ContentType::json())
        .body("{\"message\": \"pong\"}")
}

#[head("/ping")]
async fn ping_head() -> impl Responder {
    HttpResponse::NoContent().finish()
}

#[derive(Deserialize)]
struct DownloadQuery {
    count: Option<String>,
    size: Option<String>,
}

#[get("/download")]
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

    // OPTIMIZE: Pre-allocate all chunks upfront, avoid clone in stream
    // Each chunk is independent, allowing zero-copy streaming
    let chunks: Vec<Bytes> = (0..count).map(|_| Bytes::from(vec![0u8; size])).collect();

    HttpResponse::Ok()
        .content_type("application/octet-stream")
        .append_header((
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0",
        ))
        .append_header(("Content-Disposition", "attachment; filename=random.dat"))
        .append_header(("Content-Transfer-Encoding", "binary"))
        .streaming(iter(chunks).map(Ok::<_, Error>))
}

#[post("/upload")]
async fn upload(mut body: web::Payload) -> impl Responder {
    // OPTIMIZE: Consume stream efficiently without unnecessary processing
    while let Some(_chunk) = body.next().await {
        // Chunk is automatically dropped, TCP backpressure is handled by actix
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
            // OPTIMIZE: Configure worker count and connection pool for high throughput
            let server = HttpServer::new(|| {
                App::new()
                    .wrap(
                        middleware::DefaultHeaders::new().add(("Access-Control-Allow-Origin", "*")),
                    )
                    .service(download)
                    .service(upload)
                    .service(upload_options)
                    .service(ping_get)
                    .service(ping_head)
                    .service(static_resource)
                    .service(index)
            })
            .workers(4) // Use 4 workers for better concurrency
            .max_connections(2048) // Increase max concurrent connections
            .keep_alive(Duration::from_secs(60)); // Keep connections alive for 60s

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

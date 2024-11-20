## web
FROM node:lts as web-build
WORKDIR /app
COPY Makefile ./
COPY web/ ./web/
RUN corepack enable && make bootstrap-web && make build-web

## server
FROM rust:1.82-alpine3.20 AS server-build
WORKDIR /app
COPY Makefile ./
COPY server/ ./server/
COPY --from=web-build /app/build/static/ /app/build/static
RUN apk add build-base && make bootstrap-server && make build-server

FROM alpine:3.20
WORKDIR /app
EXPOSE 3300
COPY --from=server-build /app/server/target/release/homebox /app/homebox
CMD [ "./homebox", "serve" ]

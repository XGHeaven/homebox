## web
FROM node:lts as web-build
WORKDIR /app
COPY Makefile ./
COPY web/ ./web/
RUN corepack enable && make bootstrap-web && make build-web

## server
FROM golang:1.21 AS server-build
WORKDIR /app
COPY Makefile ./
COPY server/ ./server/
COPY --from=web-build /app/build/static/ /app/build/static
RUN go install github.com/go-bindata/go-bindata/...@v3
RUN make bootstrap-server && make build-server

FROM alpine
WORKDIR /app
EXPOSE 3300
COPY --from=server-build /app/build/server /app/server
CMD [ "./server" ]

## server
FROM golang:1.14 AS server-build-env

WORKDIR /app

COPY server/go.* ./server/

RUN go get -u github.com/go-bindata/go-bindata/...

RUN cd server && go mod download

## web
FROM node:lts as web-build-env

WORKDIR /app

COPY web/package.json ./web/

RUN cd web && npm i

FROM web-build-env AS web-build

COPY Makefile ./

COPY web/ ./web/

RUN make build-web

FROM server-build-env AS server-build

COPY Makefile ./

COPY server/*.go ./server/
COPY --from=web-build /app/build/static/ /app/build/static

RUN make build-server

FROM alpine

WORKDIR /app

EXPOSE 3300

COPY --from=server-build /app/build/server /app/server

CMD [ "./server" ]

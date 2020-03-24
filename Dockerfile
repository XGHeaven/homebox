## server
FROM golang:1.14 AS server-build-env

WORKDIR /app

COPY server/go.* ./server/

RUN cd server && go mod download

## web
FROM node:lts as web-build-env

WORKDIR /app

COPY web/package* ./web/

RUN cd web && npm ci --registry=https://registry.npm.taobao.org

FROM server-build-env AS server-build

COPY Makefile ./

COPY server/*.go ./server/

RUN make build-server

FROM web-build-env AS web-build

COPY Makefile ./

COPY web/ ./web/

RUN make build-web

FROM alpine

WORKDIR /app

COPY --from=server-build /app/build/ /app/
COPY --from=web-build /app/build/ /app/

RUN ls

CMD [ "./server" ]

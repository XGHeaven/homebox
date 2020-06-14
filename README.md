# Homebox

家庭网络工具箱，主要用于组建家庭局域网时的一些调试、检测、压测工具。

> 需要家庭内有一个较强服务端，否则服务端可能会成为瓶颈。测试端需要使用现代新版浏览器，比如 Chrome/Firefox 等。

## Feature

- 面向未来浏览器设计
- 高达 10G 的浏览器速度测试
- 自带 Ping 检测
- 丰富的自定义测速参数
- 低硬件要求，无需固态
- 友好的 UI 交互
- 针对低速网络(< 2.5G)优化测速资源占用

## Screenshot

![dark-theme](./doc/dark-theme.png)

![light-theme](./doc/light-theme.png)

## Install

### Docker

首先你需要有一台服务器，只要能支持安装 Docker 即可，比如群辉、FreeNas、unRaid、CentOS 等等。
暂时只支持 x86 docker 服务器。

安装并启动 `xgheaven/homebox` 镜像，默认情况下暴露的端口是 `3300`。
然后在浏览器中输入 `http://server.ip:3300` 即可，如果重映射了端口，请输入映射后的端口

### Binary

TODO，还在准备中

## Tests

- 在 2017 款 13 寸 Macbook 上，低速配置下能够实现 4G 下载速度以及 3G 上传速度
- 在 2019 款 16 寸 Macbook 上，在开启多 Worker 多线程的情况下，最高可以达到 12G 的下载速度以及 10G 的上传速度

# Homebox

家庭网络工具箱。用于组建家庭局域网时，对网络进行调试、检测、压测的工具集合。

## Feature

- 面向未来浏览器设计
- 高达 10G 的浏览器速度测试
- 自带 Ping 检测
- 丰富的自定义测速参数
- 服务端无需像传统文件拷贝一样需要固态的支持
- 友好的 UI 交互
- 针对低速网络(< 2.5G)优化测速资源占用

[v1 进度追踪看板](https://github.com/XGHeaven/homebox/projects/1)

![dark-theme](./doc/dark-theme.png)

![light-theme](./doc/light-theme.png)

## Requirement

- 本软件需要一个服务端进行部署，然后通过客户端访问网页进行测试
- 当需要对万兆以上网络测试的时候，需要保证客户端的性能（主要为 CPU 单核）足够强劲，否则可能会成为瓶颈。
  具体的要求可以看后文的[性能测试](#Performance)

## Install

### Docker

首先你需要有一台服务器，只要能支持安装 Docker 即可，比如群辉、FreeNas、unRaid、CentOS 等等，暂时只支持 x86 服务器。

```bash
docker run -d -p 3300:3300 --name homebox xgheaven/homebox
```

安装并启动 `xgheaven/homebox` 镜像，默认情况下暴露的端口是 `3300`。
然后在浏览器中输入 `http://your.server.ip:3300` 即可。

### Binary

直接在 [Release](https://github.com/XGHeaven/homebox/releases) 下载对应版本即可。

解压之后直接执行 serve 命令即可启动服务，参数如下

```text
Usage: homebox serve [OPTIONS]

Options:
      --port <PORT>  Port to listen
      --host <HOST>  Host to listen
  -h, --help         Print help
```

## Usage

输入网址之后，会看到分为两种测试模式，分别是单次测速和持续压测。

- **单次测速**的模式下，会依次执行 Ping/Download/Upload 测试，一般可以直接用这个模式。
- **持续压测**的模式下，可以不限时的以最高速度压测链路，通常可以用于设备移动中链路稳定性测试、多设备压测、路由器转发散热性能测试等。

默认情况下，设备会以低速模式运行，适用于大部分网络情况。
也可以在**高级配置**中切换为高速模式，此时会将客户端资源榨干的方式尽可能压榨网络流量，用于万兆以上的高速网络。

### Terminal(WIP)

某些极端情况下，机器性能不足或者浏览器版本过低，可以直接通过复制浏览器中提供的测速脚本，在终端中测速。
一方面方便某些懒人不愿意打命令行，另一方面脱离了浏览器的环境，测速性能和准确度会更高

## Design

由于众所周知的原因，浏览器中 JavaScript 的效率是比较低的，再加上网络请求的时候，需要占用大量的内存。
所以为了避免主线程的卡顿，所有的请求都是在 Web Worker 中进行的。

但仅仅一个 Worker 是支撑不住万兆网络的测速要求的，因为一个 Worker 并发请求的能力依旧很低。
比如使用 curl 单链接单进程最高可以达到 2GB/s 的速度，核算过来大约 16Gbps。
而一个 Worker 就算是开启多请求并发的速度，也仅仅只能达到 500MB/s，可见性能有多低。

解决方案也很简单，创建多个 Worker 叠加测速，来叠加到万兆网络的要求。
但是多个 Worker 对机器的性能要求很高，如果只是用于千兆网络测速，而机器性能又比较弱，就会导致测速不准。

这就是为什么会有两种模式的原因，**高速模式**和**低速模式**。
在高速模式下，会启用多 Worker，而低速模式下，仅仅启用一个 Worker 来减少资源的占用。

## Performance

> 目前我暂时没有万兆以上的移动端设备，如果哪位小伙伴有的话，可以将结果告诉我

以下为客户端测试

- 在 2017 款 13 寸 Macbook 上，低速配置下能够实现 4G 下载速度以及 3G 上传速度
- 在 2019 款 16 寸 Macbook 上，在开启高速模式下，最高可以达到 12G 的下载速度以及 10G 的上传速度
- 在 AMD 3600 的设备上，高速模式下可以达到 15G 的下载速度以及 12G 的上传速度
- 在 M2 Macbook Air 的设备上，低速模式可以达到 20G 的下载速度以及 16G 的上传速度，不建议开启高速模式，会导致资源调度竞争从而数值下降且不稳定

## Powered by

- Rust(actix-web) 服务端
- TypeScript 前端语言
- React 前端框架
- Rspack 前端打包工具
- 其他依赖请查看相应文件

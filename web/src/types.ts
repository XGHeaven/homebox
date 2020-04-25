export enum ChannelType {
  START,
  ERROR,
  PING_TEST,
  UPLOAD_TEST,
  DOWNLOAD_TEST,
  RUN_DOWNLOAD
}

export enum RunningMode {
  // 单次测速
  ONCE = 'once',
  // 持续测速
  CONTINUE = 'continue'
}

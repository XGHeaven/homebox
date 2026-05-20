import { Locale } from './types'

export const messages = {
  en: {
    'app.download': 'Download',
    'app.upload': 'Upload',
    'app.ping': 'Ping',
    'action.start': 'Start',
    'action.stop': 'Stop',
    'action.restart': 'Restart',
    'state.waiting': 'Waiting...',
    'state.downloading': 'Downloading',
    'state.uploading': 'Uploading',
    'state.pinging': 'Pinging',
    'error.environment': 'Error, please check environment',
    'config.mode.once': 'Single test',
    'config.mode.continue': 'Continuous test',
    'config.advanced.show': 'Switch to advanced config',
    'config.advanced.hide': 'Switch to simple config',
    'config.duration': 'Test duration',
    'config.speedRange': 'Test speed range',
    'config.speedRange.help':
      'Low speed mode avoids exhausting system resources; high speed mode uses as many system resources as possible.',
    'config.speedRange.low': 'Low speed (usually below 2.5G)',
    'config.speedRange.high': 'High speed (usually above 2.5G)',
    'config.threadCount': 'Thread Count',
    'config.threadCount.help':
      'Number of test workers. Tune this based on device performance. Usually 3 workers are enough for 10G network tests. Low speed mode defaults to 1; high speed mode defaults to logical processors - 1.',
    'config.packCount': 'Pack Count',
    'config.packCount.help': 'Controls the amount of data downloaded or uploaded per request.',
    'config.parallel': 'Parallel',
    'config.parallel.help': 'Parallel request count. 3 is recommended; set it to 1 for single-thread tests.',
    'config.language': 'Language',
    'footer.notice':
      'Test results usually only represent the real data that can be achieved under the current device performance. They have no theoretical reference value and should not be used as theoretical link data.',
  },
  zh: {
    'app.download': '下载',
    'app.upload': '上传',
    'app.ping': 'Ping',
    'action.start': '开始',
    'action.stop': '停止',
    'action.restart': '重新开始',
    'state.waiting': '等待中...',
    'state.downloading': '下载中',
    'state.uploading': '上传中',
    'state.pinging': 'Ping 中',
    'error.environment': '出错了，请检查运行环境',
    'config.mode.once': '单次测速',
    'config.mode.continue': '持续压测',
    'config.advanced.show': '切换到高级配置',
    'config.advanced.hide': '切换到普通配置',
    'config.duration': '测速持续时间',
    'config.speedRange': '测速速度范围',
    'config.speedRange.help': '低速模式下不会压榨系统资源；高速模式下会尽力压榨系统资源',
    'config.speedRange.low': '低速 (通常网络小于 2.5G)',
    'config.speedRange.high': '高速 (通常网络大于 2.5G)',
    'config.threadCount': 'Thread Count',
    'config.threadCount.help':
      '测速 Worker 数量，根据你的机器性能适当选择。一般来说 3 个足够满足万兆网络测速。低速模式下，默认为 1 个，高速模式下，默认为系统逻辑处理器数量 - 1',
    'config.packCount': 'Pack Count',
    'config.packCount.help': '控制单次请求下载或上传的数据大小',
    'config.parallel': 'Parallel',
    'config.parallel.help': '并行数量，推荐 3 个，如果想要测试单线程，可以调整为 1',
    'config.language': '语言',
    'footer.notice':
      '测试结果通常只能代表当前设备性能下所能跑到的实际数据， 没有任何理论参考价值，不能作为链路理论数据使用。',
  },
} as const

export type TranslationKey = keyof typeof messages.en

export function normalizeLocale(locale?: string): Locale {
  if (locale?.toLowerCase().startsWith('zh')) {
    return Locale.Zh
  }
  return Locale.En
}

export function createTranslator(locale: Locale) {
  const localeMessages = messages[locale] ?? messages.en
  return (key: TranslationKey) => localeMessages[key] ?? messages.en[key]
}

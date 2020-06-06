import 'regenerator-runtime/runtime'
import 'core-js/stable'

import { WorkerChannel } from './channel'
import { download, downloadFiber } from './cases/download'
import { upload, uploadFiber } from './cases/upload'

const channelModule = {
  name: () => 'some name',
  download,
  upload,
  downloadFiber,
  uploadFiber,
}

export type ChannelModule = typeof channelModule

const channel = new WorkerChannel(channelModule)

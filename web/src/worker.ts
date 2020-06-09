import 'regenerator-runtime/runtime'
import 'core-js/stable'

import { WorkerChannel } from './channel'
import { download } from './cases/download'
import { upload } from './cases/upload'

const channelModule = {
  name: () => 'some name',
  download,
  upload,
}

export type ChannelModule = typeof channelModule

const channel = new WorkerChannel(channelModule)

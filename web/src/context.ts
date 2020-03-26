import { createContext } from "react";
import { HostChannel } from "./channel";
import type { ChannelModule } from './worker'
import { rateFormatters, RateFormatter } from "./utils";

export const ChannelContext = createContext<() => Promise<HostChannel<ChannelModule>>>(null as any)

export const RateFormatterContext = createContext<RateFormatter>(rateFormatters.bit)

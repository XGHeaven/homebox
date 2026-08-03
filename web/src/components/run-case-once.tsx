import { SpeedIndicator } from './speed-indicator'
import { appendRatePoint, RateCurve } from './rate-curve'
import styled from '@emotion/styled'
import { useState, useContext, useEffect, useRef } from 'react'
import { useRates } from '../hooks'
import { ChannelsContext, ConfigContext, I18nContext } from '../context'
import { zip, interval, Observable, Subscription } from 'rxjs'
import { rateFormatters } from '../utils'
import { Button, Intent } from '@blueprintjs/core'
import { $textCenter, $mgt } from '../styles/utils'
import { css } from '@emotion/react'
import { take, mergeMap } from 'rxjs/operators'
import { ping } from '../cases/ping'
import { showToast } from '../toaster'

const $Header = styled.div`
  display: flex;
`

const $HeaderCase = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  text-align: center;
`

const $CaseTitle = styled.div``
const $CaseContent = styled.div`
  font-size: 24px;
  font-weight: bold;
`

type ChartKey = 'ping' | 'download' | 'upload'
type ChartItem = {
  key: ChartKey
  title: string
  rates: number[]
  running: boolean
  formatter: (rate: number) => string
}

const chartKeys: ChartKey[] = ['ping', 'download', 'upload']

enum RunningStep {
  NONE = 1,
  PING,
  DOWNLOAD,
  UPLOAD,
  DONE,
}

export function RunCaseOnce() {
  const [dlRate, setDlRate] = useState(-1)
  const [ulRate, setUlRate] = useState(-1)
  const [pingRates, setPingRates] = useState<number[]>([])
  const [dlRates, setDlRates] = useState<number[]>([])
  const [ulRates, setUlRates] = useState<number[]>([])
  const [activeChart, setActiveChart] = useState<ChartKey>('ping')
  const [ttl, pushTTL, clearTTL] = useRates(5)
  const [step, setStep] = useState(RunningStep.NONE)
  const sub = useRef<Subscription | null>(null)
  const runIdRef = useRef(0)
  const createChannels = useContext(ChannelsContext)
  const t = useContext(I18nContext)
  const { duration, parallel, packCount, unit } = useContext(ConfigContext)

  useEffect(
    () => () => {
      runIdRef.current += 1
      sub.current?.unsubscribe()
      sub.current = null
    },
    [],
  )

  const waitObservable = <T,>(observer: Observable<T>, onNext: (value: T) => void, runId: number) =>
    new Promise<void>((resolve, reject) => {
      let settled = false
      const resolveOnce = () => {
        if (!settled) {
          settled = true
          sub.current = null
          resolve()
        }
      }
      const rejectOnce = (error: unknown) => {
        if (!settled) {
          settled = true
          sub.current = null
          reject(error)
        }
      }
      const subscription = observer.subscribe({
        next(value) {
          if (runIdRef.current === runId) {
            onNext(value)
          }
        },
        error(error) {
          rejectOnce(error)
        },
        complete() {
          resolveOnce()
        },
      })
      subscription.add(resolveOnce)
      sub.current = subscription
    })

  const _start = async () => {
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    clearTTL()
    setDlRate(-1)
    setUlRate(-1)
    setPingRates([])
    setDlRates([])
    setUlRates([])
    setActiveChart('ping')
    setStep(RunningStep.PING)
    await waitObservable(
      interval(500).pipe(
        take(10),
        mergeMap(() => ping()),
      ),
      (v) => {
        pushTTL(v)
        setPingRates((prevRates) => appendRatePoint(prevRates, v))
      },
      runId,
    )
    if (runIdRef.current !== runId) {
      return
    }
    const channels = await createChannels()
    if (runIdRef.current !== runId) {
      return
    }

    setStep(RunningStep.DOWNLOAD)
    setActiveChart('download')
    await waitObservable(
      zip(
        ...channels.map((channel) =>
          channel.observe('download', {
            duration,
            packCount,
            parallel,
            interval: 500,
          }),
        ),
      ),
      (v) => {
        const nextRate = v.reduce((a, b) => a + b, 0)
        setDlRate(nextRate)
        setDlRates((prevRates) => appendRatePoint(prevRates, nextRate))
      },
      runId,
    )
    if (runIdRef.current !== runId) {
      return
    }

    setStep(RunningStep.UPLOAD)
    setActiveChart('upload')

    await waitObservable(
      zip(
        ...channels.map((channel) =>
          channel.observe('upload', {
            duration,
            packCount,
            parallel,
            interval: 500,
          }),
        ),
      ),
      (v) => {
        const nextRate = v.reduce((a, b) => a + b, 0)
        setUlRate(nextRate)
        setUlRates((prevRates) => appendRatePoint(prevRates, nextRate))
      },
      runId,
    )
    if (runIdRef.current !== runId) {
      return
    }

    setStep(RunningStep.DONE)
    setActiveChart('download')
  }

  const start = () => {
    _start().catch(() => {
      showToast({
        message: t('error.environment'),
        intent: Intent.DANGER,
        icon: 'warning-sign',
      })
      setStep(RunningStep.DONE)
    })
  }

  const stop = () => {
    runIdRef.current += 1
    sub.current?.unsubscribe()
    sub.current = null
    setStep(RunningStep.DONE)
  }

  const chartItems: ChartItem[] = [
    {
      key: 'ping',
      title: t('app.ping'),
      rates: pingRates,
      running: step === RunningStep.PING,
      formatter: (rate: number) => `${rate.toFixed(2)} ms`,
    },
    {
      key: 'download',
      title: t('app.download'),
      rates: dlRates,
      running: step === RunningStep.DOWNLOAD,
      formatter: rateFormatters[unit],
    },
    {
      key: 'upload',
      title: t('app.upload'),
      rates: ulRates,
      running: step === RunningStep.UPLOAD,
      formatter: rateFormatters[unit],
    },
  ]
  const activeChartTitle = chartItems.find((chart) => chart.key === activeChart)?.title
  const formatRate = (rate: number) => (rate >= 0 ? rateFormatters[unit](rate) : '--')
  const runningSpeed = step === RunningStep.DOWNLOAD ? dlRate : step === RunningStep.UPLOAD ? ulRate : undefined
  const switchChart = (direction: -1 | 1) => {
    const currentIndex = chartKeys.indexOf(activeChart)
    const nextIndex = (currentIndex + direction + chartKeys.length) % chartKeys.length
    setActiveChart(chartKeys[nextIndex])
  }

  return (
    <div>
      <$Header>
        <$HeaderCase>
          <$CaseTitle>{t('app.ping')}</$CaseTitle>
          <$CaseContent>{step >= RunningStep.PING ? `${ttl.toFixed(2)} ms` : '--'}</$CaseContent>
        </$HeaderCase>

        <$HeaderCase>
          <$CaseTitle>{t('app.download')}</$CaseTitle>
          <$CaseContent>{step >= RunningStep.DOWNLOAD ? formatRate(dlRate) : '--'}</$CaseContent>
        </$HeaderCase>

        <$HeaderCase>
          <$CaseTitle>{t('app.upload')}</$CaseTitle>
          <$CaseContent>{step >= RunningStep.UPLOAD ? formatRate(ulRate) : '--'}</$CaseContent>
        </$HeaderCase>
      </$Header>
      <SpeedIndicator
        speed={runningSpeed !== undefined && runningSpeed >= 0 ? runningSpeed : undefined}
        running={step !== RunningStep.DONE && step !== RunningStep.NONE}
      />
      {step !== RunningStep.NONE ? (
        <div
          css={css`
            margin-top: 12px;
          `}
        >
          <div
            css={css`
              display: grid;
              grid-template-columns: 36px minmax(0, 1fr) 36px;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;

              @media (min-width: 960px) {
                display: none;
              }
            `}
          >
            <Button
              small
              minimal
              icon='chevron-left'
              aria-label={t('action.previous')}
              onClick={() => switchChart(-1)}
            />
            <div
              css={css`
                min-width: 0;
                text-align: center;
                font-weight: bold;
              `}
            >
              {activeChartTitle}
            </div>
            <Button small minimal icon='chevron-right' aria-label={t('action.next')} onClick={() => switchChart(1)} />
          </div>
          <div
            css={css`
              display: grid;
              grid-template-columns: 1fr;
              gap: 12px;

              @media (min-width: 960px) {
                grid-template-columns: repeat(3, minmax(0, 1fr));
              }
            `}
          >
            {chartItems.map((chart) => (
              <div
                key={chart.key}
                css={css`
                  display: ${activeChart === chart.key ? 'block' : 'none'};
                  text-align: left;

                  @media (min-width: 960px) {
                    display: block;
                  }
                `}
              >
                <div
                  css={css`
                    display: none;
                    font-weight: bold;
                    text-align: center;

                    @media (min-width: 960px) {
                      display: block;
                    }
                  `}
                >
                  {chart.title}
                </div>
                <RateCurve rates={chart.rates} running={chart.running} formatter={chart.formatter} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div
        css={css`
          ${$textCenter}${$mgt[4]}
        `}
      >
        <Button onClick={step !== RunningStep.NONE && step !== RunningStep.DONE ? stop : start}>
          {
            {
              [RunningStep.NONE]: t('action.start'),
              [RunningStep.DOWNLOAD]: t('action.stop'),
              [RunningStep.PING]: t('action.stop'),
              [RunningStep.UPLOAD]: t('action.stop'),
              [RunningStep.DONE]: t('action.restart'),
            }[step]
          }
        </Button>
      </div>
    </div>
  )
}

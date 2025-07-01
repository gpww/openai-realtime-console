/**
 * Running a local relay server will allow you to hide your API key
 * and run custom logic on the server
 *
 * Set the local relay server address to:
 * REACT_APP_LOCAL_RELAY_SERVER_URL=http://localhost:8081
 *
 * This will also require you to set OPENAI_API_KEY= in a `.env` file
 * You can run it with `npm run relay`, in parallel with `npm start`
 */
const REACT_APP_SERVER_URL: string =
  process.env.REACT_APP_SERVER_URL || '';
const OPENAI_API_KEY: string = process.env.REACT_APP_Goodix_KEY || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from 'realtime-api-beta-local';
import type { ItemType } from 'realtime-api-beta-local/dist/lib/client.js';
import { NativeAudioRecorder, NativeAudioPlayer } from '../lib/wavtools/nativeAudio.js'; // 替换为 nativeAudio
import { WavRenderer } from '../utils/wav_renderer';
import { instructions } from '../utils/conversation_config.js';

import { X, Edit, Zap, ArrowUp, ArrowDown } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';
import { v4 as uuidv4 } from 'uuid';

import './ConsolePage.scss';
/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

export function DebugPage() {
  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
  const apiKey = REACT_APP_SERVER_URL
    ? OPENAI_API_KEY
    : localStorage.getItem('tmp::voice_api_key') ||
    prompt('OpenAI API Key') ||
    '';
  if (apiKey !== '') {
    localStorage.setItem('tmp::voice_api_key', apiKey);
  }

  /**
   * Instantiate:
   * - NativeAudioRecorder (speech input with echo cancellation)
   * - NativeAudioPlayer (speech output with better compatibility) 
   * - RealtimeClient (API client)
   */
  const audioRecorderRef = useRef<NativeAudioRecorder>(
    new NativeAudioRecorder({ recordingSampleRate: 16000, channels: 1 })
  );
  const audioPlayerRef = useRef<NativeAudioPlayer>(
    new NativeAudioPlayer({ playbackSampleRate: 24000, channels: 1 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient(
      {
        apiKey: apiKey,
        url: REACT_APP_SERVER_URL,
        dangerouslyAllowAPIKeyInBrowser: true,
      }
    )
  );

  /**
   * References for
   * - Rendering audio visualization (canvas)
   * - Autoscrolling event logs
   * - Timing delta for event log displays
   */
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  // Add this near your other refs
  const isConnectedRef = useRef(isConnected);
  // Update the ref whenever isConnected changes
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);
  const canPushToTalkRef = useRef(true);
  const [canPushToTalk, setCanPushToTalk] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  // 定义模型选项（显示名称: 实际名称）
  const modelOptions: Record<string, string> = {
    '千问Plus': 'qwen-plus',
    '千问Turbo': 'qwen-turbo',
    '千问Max': 'qwen-max',
    '豆包极速': 'doubao-1-5-lite-32k',
    '豆包Pro': 'doubao-1-5-pro-32k',
    '豆包角色扮演': 'doubao-1-5-pro-32k-character',
    'Moonshot 32k': 'moonshot-v1-32k',
    'Moonshot 128k': 'moonshot-v1-128k',
    'GPT-4o': 'gpt-4o',
    'GPT-4o-mini': 'gpt-4o-mini',
    // 'qwen2.5-7b-instruct': 'qwen2.5-7b-instruct',
    // 'yi-large-fc': 'yi-large-fc',
  };
  const modelNames = Object.keys(modelOptions);

  const [selectedModel, setSelectedModel] = useState(modelNames[0]);
  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(event.target.value);
  }, []);
  /**
   * Utility for formatting the timing of logs
   */
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  /**
   * When you click the API key
   */
  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  const getUserId = () => {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = `test_${uuidv4()}`;
      localStorage.setItem('userId', userId);
    }
    return userId;
  };

  /**
   * Connect to conversation:
   * NativeAudioRecorder takes speech input, NativeAudioPlayer for output, client is API client
   */
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const audioRecorder = audioRecorderRef.current;
    const audioPlayer = audioPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    const userId = getUserId();
    // Connect to realtime API
    await client.connect({ model: modelOptions[selectedModel], userId });

    client.updateSession(
      {
        instructions: instructions,
        voice: '龙婉',
        // turn_detection: { type: 'server_vad' }
        input_audio_format: 'Raw16KHz16BitMonoPcm',
        output_audio_format: 'Raw24KHz16BitMonoPcm', // 更新为24kHz输出
      });

    client.sendUserMessageContent([
      {
        type: "input_text",
        text: "用户又上线了，请根据聊天历史打个招呼，或者提个问题，或者说点什么。",
        // type: `tts_text`,
        // text: `你来啦？`,
      }
    ]);

    // Connect to microphone with echo cancellation
    await audioRecorder.begin();

    // Connect to audio output
    await audioPlayer.connect();

    if (client.getTurnDetectionType() === 'server_vad') {
      await audioRecorder.record((data: { mono: Int16Array }) => client.appendInputAudio(data.mono));
    }
  }, [selectedModel]);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    const client = clientRef.current;
    client.disconnect();

    const audioRecorder = audioRecorderRef.current;
    await audioRecorder.end();

    const audioPlayer = audioPlayerRef.current;
    await audioPlayer.interrupt();
  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  /**
   * In push-to-talk mode, start recording
   * .appendInputAudio() for each sample
   */
  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const audioRecorder = audioRecorderRef.current;
    const audioPlayer = audioPlayerRef.current;
    await audioPlayer.interrupt();

    // 简化中断处理，不需要trackId
    await client.cancelResponse();

    if (!audioRecorder.recording)
      await audioRecorder.record((data: { mono: Int16Array }) => client.appendInputAudio(data.mono));
  };

  /**
   * In push-to-talk mode, stop recording
   */
  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const audioRecorder = audioRecorderRef.current;
    if (audioRecorder.recording)
      await audioRecorder.pause();
    client.createResponse();
  };

  /**
   * Switch between Manual <> VAD mode for communication
   */
  const changeTurnEndType = async (value: string) => {
    const client = clientRef.current;
    const audioRecorder = audioRecorderRef.current;
    if (value === 'none' && audioRecorder.recording) {
      await audioRecorder.pause();
    }
    client.updateSession({
      turn_detection: value === 'none' ? null : { type: 'server_vad' },
    });
    if (value === 'server_vad' && client.isConnected()) {
      await audioRecorder.record((data: { mono: Int16Array }) => client.appendInputAudio(data.mono));
    }
    setCanPushToTalk(value === 'none');
    canPushToTalkRef.current = value === 'none';
  };

  /**
   * Auto-scroll the event logs
   */
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  /**
   * Auto-scroll the conversation logs
   */
  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);

  /**
   * Set up render loops for the visualization canvas
   */
  useEffect(() => {
    let isLoaded = true;

    const audioRecorder = audioRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const audioPlayer = audioPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = audioRecorder.recording
              ? audioRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = audioPlayer
              ? audioPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const audioPlayer = audioPlayerRef.current;
    const client = clientRef.current;

    // handle realtime events from client + server for event logging
    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        //   const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        //   if (lastEvent?.event.type === realtimeEvent.event.type) {
        //     // if we receive multiple events in a row, aggregate them for display purposes
        //     lastEvent.count = (lastEvent.count || 0) + 1;
        //     return realtimeEvents.slice(0, -1).concat(lastEvent);
        //   } else {
        //     return realtimeEvents.concat(realtimeEvent);
        //   }
        return realtimeEvents.concat(realtimeEvent);
      });
    });
    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      await audioPlayer.interrupt(); // 简化中断处理
      await client.cancelResponse(); // 不需要trackId参数
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      if (delta?.audio) {
        let audioData = delta.audio;
        // Native audio player handles Int16Array directly
        audioPlayer.add16BitPCM(audioData, item.id);
      }

      // 简化音频文件处理，移除 WavRecorder.decode
      // if (item.status === 'completed' && item.formatted.audio?.length) {
      //   var sampleRate = item.role === 'user' ? 16000 : 24000;
      //   const wavFile = await WavRecorder.decode(
      //     item.formatted.audio,
      //     sampleRate,
      //     sampleRate
      //   );
      //   item.formatted.file = wavFile;
      // }
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      // cleanup; resets to defaults
      client.reset();
    };
  }, []);

  /**
   * Render the application
   */
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          {/* <img src="/openai-logomark.svg" /> */}
          <img src="/xstarcity4.png" alt="xStar Logo" />
          {/* <span>realtime console</span> */}
        </div>
        <div className="model-selector">
          <label htmlFor="model-select">选择模型：</label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={handleModelChange}
            disabled={isConnected}
          >
            {modelNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="content-main">
        <div className="content-logs">
          <div className="content-block events">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
            <div className="content-block-title">events</div>
            <div className="content-block-body" ref={eventsScrollRef}>
              {!realtimeEvents.length && `awaiting connection...`}
              {realtimeEvents.map((realtimeEvent, i) => {
                const count = realtimeEvent.count;
                const event = { ...realtimeEvent.event };
                if (event.type === 'input_audio_buffer.append') {
                  event.audio = `[trimmed: ${event.audio.length} bytes]`;
                } else if (event.type === 'response.audio.delta') {
                  event.delta = `[trimmed: ${event.delta.length} bytes]`;
                }
                return (
                  <div className="event" key={event.event_id}>
                    <div className="event-timestamp">
                      {formatTime(realtimeEvent.time)}
                    </div>
                    <div className="event-details">
                      <div
                        className="event-summary"
                        onClick={() => {
                          // toggle event details
                          const id = event.event_id;
                          const expanded = { ...expandedEvents };
                          if (expanded[id]) {
                            delete expanded[id];
                          } else {
                            expanded[id] = true;
                          }
                          setExpandedEvents(expanded);
                        }}
                      >
                        <div
                          className={`event-source ${event.type === 'error'
                            ? 'error'
                            : realtimeEvent.source
                            }`}
                        >
                          {realtimeEvent.source === 'client' ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          )}
                          <span>
                            {event.type === 'error'
                              ? 'error!'
                              : realtimeEvent.source}
                          </span>
                        </div>
                        <div className="event-type">
                          {event.type}
                          {count && ` (${count})`}
                        </div>
                      </div>
                      {!!expandedEvents[event.event_id] && (
                        <div className="event-payload">
                          {JSON.stringify(event, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-block conversation-debug">
            <div className="content-block-title">conversation</div>
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                      <div
                        className="close"
                        onClick={() =>
                          deleteConversationItem(conversationItem.id)
                        }
                      >
                        <X />
                      </div>
                    </div>
                    <div className={`speaker-content`}>
                      {/* tool response */}
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      {/* tool call */}
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                '(item sent)')}
                          </div>
                        )}
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                      {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="content-actions">
            <Toggle
              defaultValue={false}
              labels={['manual', 'vad']}
              values={['none', 'server_vad']}
              onChange={(_, value) => changeTurnEndType(value)}
            />
            <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={(event) => {
                  if (event.buttons === 1) {
                    stopRecording();// 如果鼠标左键被按下，则停止录音
                  }
                }}
              />
            )}
            <div className="spacer" />
            <Button
              label={isConnected ? 'disconnect' : 'connect'}
              iconPosition={isConnected ? 'end' : 'start'}
              icon={isConnected ? X : Zap}
              buttonStyle={isConnected ? 'regular' : 'action'}
              onClick={
                isConnected ? disconnectConversation : connectConversation
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
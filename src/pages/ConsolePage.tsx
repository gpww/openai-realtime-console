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
const OPENAI_API_KEY: string = process.env.REACT_APP_OPENAI_API_KEY || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from 'realtime-api-beta-local';
import { ItemType, AudioFormatType } from 'realtime-api-beta-local/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown,Phone } from 'react-feather';
import { FaMicrophone, FaMicrophoneSlash} from 'react-icons/fa';
import { Button } from '../components/button/Button';

import './ConsolePage.scss';
import { v4 as uuidv4 } from 'uuid';

// 定义模型选项
const modelOptions = [
  'qwen-max',
  'qwen-plus',
  'moonshot-v1-32k',
  'moonshot-v1-128k',
  'gpt-4o',
  'gpt-4o-mini',
  //'yi-large-fc',
  'doubao-pro-32k'
];

export function ConsolePage() {
  const [selectedModel, setSelectedModel] = useState(modelOptions[0]);

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(event.target.value);
  };

  useEffect(() => {
    document.title = 'xStar实时语音';
  }, []);

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
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 16000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 8000 })
  );
  const audioContext = new window.AudioContext({ sampleRate: 8000 });
  const isMp3 = false;
  const decodeMp3 = useCallback((arrayBuffer: Int16Array) => {
    return new Promise<AudioBuffer>((resolve, reject) => {
      const buffer = arrayBuffer.buffer; // 获取底层的 ArrayBuffer
      audioContext.decodeAudioData(buffer as ArrayBuffer)
        .then(decodedData => {
          resolve(decodedData);
        })
        .catch(error => {
          console.error('Error decoding audio data:', error);
          reject(error);
        });
    });
  }, [audioContext]);

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
  const startTimeRef = useRef<string>(new Date().toISOString());

  /**
   * All of our variables for displaying application state
   * - items are all conversation items (dialog)
   * - realtimeEvents are event logs, which can be expanded
   * - memoryKv is for set_memory() function
   * - coords, marker are for get_weather() function
   */
  const [items, setItems] = useState<ItemType[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  // Add this near your other refs
  const isConnectedRef = useRef(isConnected);
  // Update the ref whenever isConnected changes
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  // const isBotSpeaking = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

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
   * WavRecorder taks speech input, WavStreamPlayer output, client is API client
   */
  const connectConversation = useCallback(async () => {
    setIsConnecting(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set state variables
    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setItems(client.conversation.getItems());

    const userId = getUserId();
    // Connect to realtime API
    await client.connect({ model: selectedModel, userId});

    client.updateSession(
      {
        instructions: instructions,
        voice: '龙婉',// https://api.xstar.city/v1/realtime/voiceList 查看完整音色列表
        turn_detection: { type: 'server_vad' },//不写的话默认按压模式(server_vad = None)
        input_audio_format: 'Raw16KHz16BitMonoPcm',//不写的话默认这个
        output_audio_format: 'Raw8KHz16BitMonoPcm',//不写的话默认这个
        // output_audio_format: 'MonoMp3',//网页端解码mp3会卡顿
      });

    client.sendUserMessageContent([
      {
        type: "input_text",//正常发送文本
        // type: "tts_text",//直接回复语音，不通过大模型
        text: "用户又上线了，请根据聊天历史打个招呼，或者提个问题，或者说点什么。",
      },
    ]);

    // Connect to microphone
    await wavRecorder.begin();

    // Connect to audio output
    await wavStreamPlayer.connect();

    if(!isMutedRef.current)
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));

  }, [selectedModel]);

  /**
   * Disconnect and reset conversation state
   */
  const disconnectConversation = useCallback(async () => {
    setIsConnecting(false);
    setIsConnected(false);
    setItems([]);

    const client = clientRef.current;
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
    setIsMuted(false);//取消静音
  }, []);

  const toggleMute = useCallback(async () => {
    if(!isMutedRef.current){
      const wavRecorder = wavRecorderRef.current;
      if(wavRecorder.recording)
        await wavRecorder.pause();
    }
    else{
      const client = clientRef.current;
      const wavRecorder = wavRecorderRef.current;
      if(!wavRecorder.recording)
        await wavRecorder.record((data) => client.appendInputAudio(data.mono))
    }
    setIsMuted(!isMutedRef.current); // 更新状态
  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

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

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
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
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
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
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
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
     * 在播报中，用户点击中断按钮，停止播放并取消请求
   */
    const interrupt = async () => {
      const client = clientRef.current;
      const wavStreamPlayer = wavStreamPlayerRef.current;
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    };

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Get refs
    const wavStreamPlayer = wavStreamPlayerRef.current;
    wavStreamPlayer.onplay = async () => {
      // console.log('开始播放');
      {
        setIsConnecting(false);
        await wavStreamPlayer.interrupt();//播放前先停止之前的播放
        // isBotSpeaking.current = true;
        setIsBotSpeaking(true);
        const wavRecorder = wavRecorderRef.current;
        if(wavRecorder.recording)
          await wavRecorder.pause();
      }
    };
    wavStreamPlayer.onended = async () => {
        // isBotSpeaking.current = false;
        setIsBotSpeaking(false);
        if(!isMutedRef.current){
          const client = clientRef.current;
          const wavRecorder = wavRecorderRef.current;
          if(!wavRecorder.recording && isConnectedRef.current)
            await wavRecorder.record((data) => client.appendInputAudio(data.mono))
        }
    };
    const client = clientRef.current;

    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });
    client.on('conversation.updated', async ({ item, delta }: any) => {
      setIsConnecting(false);
      const items = client.conversation.getItems();
      if (delta?.audio) {
        let audioData = delta.audio;
        if(isMp3)
          audioData = await decodeMp3(delta.audio);
        wavStreamPlayer.add16BitPCM(audioData, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        var sampleRate = item.role === 'user' ? 16000 : 8000;
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          sampleRate,
          sampleRate
        );
      item.formatted.file = wavFile;
      // if (item.status === 'completed' && item.formatted.audio?.length) {
      //   const autoFile = new Blob([item.formatted.audio], { type: 'audio/mp3' });
      //   item.formatted.file = URL.createObjectURL(autoFile);
      }
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
          {/* <img src="/openai-logomark.svg" alt="OpenAI Logo" /> */}
          <img src="/xstarcity4.png" alt="xStar Logo" />
          {/* <span>实时语音</span> */}
        </div>
        <div className="model-selector">
            <label htmlFor="model-select">选择模型：</label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={handleModelChange}
              disabled={isConnected}
            >
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        {/* <div className="content-api-key">
          {(
            <Button
              icon={Edit}
              iconPosition="end"
              buttonStyle="flush"
              label={`api key: ${apiKey.slice(0, 3)}...`}
              onClick={() => resetAPIKey()}
            />
          )}
          
        </div> */}
      </div>
      <div className="content-main">
        {isConnecting && (
          <div className="loading-overlay">
            <div className="spinner"></div>
          </div>
        )}
        <div className="content-logs">
          <div className="content-block conversation">
            <div className="visualization">
              <div className="visualization-entry client">
                <canvas ref={clientCanvasRef} />
              </div>
              <div className="visualization-entry server">
                <canvas ref={serverCanvasRef} />
              </div>
            </div>
            {/* <div className="content-block-title">conversation</div> */}
            <div className="content-block-body" data-conversation-content>
              {!items.length && `awaiting connection...`}
              {items.map((conversationItem, i) => {
                return (
                  <div className="conversation-item" key={conversationItem.id}>
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      {conversationItem.role === 'user' ? (
                        <ArrowUp />
                      ) : (
                        <ArrowDown />
                      )}
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
                              '数据接收中...'}
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
            {isConnected && (
              <Button
                icon={isMuted ? FaMicrophoneSlash : FaMicrophone }
                buttonStyle='regular'
                onClick= {toggleMute}
              />
            )}
            <div className="spacer" />
            {isConnected && isBotSpeaking && (
                <Button
                  label='打断'
                  buttonStyle='regular'
                  onClick={interrupt}
                />
            )}
            <div className="spacer" />
            <Button
              label={isConnected ? '挂断' : '通话'}
              iconPosition={'start'}
              icon={isConnected ? Phone : Zap}
              buttonStyle={isConnected ? 'alert' : 'regular'}
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

# xStar 实时语音(OpenAI Realtime 平替接口) 调试客户端 

本项目是一个用于调试和参考 xStar realtime API 的交互式网页工具，实现实时语音对话。它内置了两个工具库：
- [openai/openai-realtime-api-beta](https://github.com/gpww/openai-realtime-api-beta) —— 浏览器及 Node.js 用参考客户端
- [`/src/lib/wavtools`](./src/lib/wavtools) —— 浏览器端音频操作工具

注意：
- 本仓库已将 https://github.com/gpww/openai-realtime-api-beta 添加为子模块，相比 OpenAI 原版，支持定制agent+国内模型+音色的自定义修改。
- 本仓库仅用于调试和参考，不适用于生产环境，浏览器兼容性（特别是手机端）可能存在问题。
- 本仓库的代码可能存在错误和问题，您使用本仓库的代码时，应自行承担风险。
- ios 设备sdk参考： https://github.com/m1guelpf/swift-realtime-openai
- python sdk 参考：https://medium.com/thedeephub/building-a-voice-enabled-python-fastapi-app-using-openais-realtime-api-bfdf2947c3e4
- c# sdk 参考：https://github.com/Azure-Samples/aoai-realtime-audio-sdk
- java sdk 参考：https://github.com/sashirestela/simple-openai?tab=readme-ov-file#using-realtime-feature
- 完整的websocket事件定义请参考：https://platform.openai.com/docs/guides/realtime-conversations#handling-audio-with-websockets

## 快速入门

### 安装

该项目使用 create-react-app 搭建，并通过 Webpack 打包：

```shell
$ npm i
```

### 配置

1. 将 `.env.example` 复制为 `.env`  
2. 在 `.env` 中填入 `REACT_APP_OPENAI_API_KEY`，API Key 可在 https://www.xstar.city/rag/ 获取

### 启动

启动开发服务器：

```shell
$ npm start
```

网页客户端运行在 `localhost:4001`。

## API 接口文档
*完整的websocket事件定义请参考：https://platform.openai.com/docs/guides/realtime-conversations#handling-audio-with-websockets

### RealtimeClient 类

用于操作实时语音 API 的核心客户端。

```javascript
import { RealtimeClient } from 'realtime-api-beta-local';

const client = new RealtimeClient({
  apiKey: apiKey,
  url: REACT_APP_SERVER_URL, 
  // 平替地址: wss://api.openai.com/v1/raltime => wss://api.xstar.city/v1/raltime
  dangerouslyAllowAPIKeyInBrowser: true,
});
```

#### 连接相关方法

##### connect(options)
建立 WebSocket 连接并启动对话。

```javascript
await client.connect({ 
  model: "qwen-max@DashScope", // 或其他模型ID
  userId: "user123" // 可选用户标识
});
```
注意用户标识是区分聊天context的关键，否则不同用户会混淆。对于单用户账号，一个apikey会对应一个用户标识。因此这里可以忽略掉。
但是对于企业用户，一个apikey可能会对应多个用户标识。为了避免不同用户的聊天context混淆，建议每个用户都使用不同的userId。

模型可以指定为：
- 单个 modelId（自动路由多个供应商）
- modelId@provider（指定供应商）

完整模型列表请查看：https://api.xstar.city/v1/models

##### disconnect()
断开 API 连接，并清除对话历史。

```javascript
client.disconnect();
```

##### isConnected()
返回连接状态和会话是否已启动。

```javascript
const connected = client.isConnected();
```

##### waitForSessionCreated()
等待服务器发出 session.created 事件。

```javascript
await client.waitForSessionCreated();
```

#### 会话配置

##### updateSession(sessionConfig)
更新会话配置，例如提示词、语音、音频格式等。

```javascript
client.updateSession({
  instructions: instructions,
  //可配置agent模板提示词，这种方式激活内置agent（with 灵活定义的用户参数）
  voice: '龙婉', // 语音名称，完整列表见 https://api.xstar.city/v1/realtime/voiceList
  turn_detection: { type: 'server_vad' }, // 语音活动检测（默认按语音片段识别）
  input_audio_format: 'Raw16KHz16BitMonoPcm', // 用户输入语音格式
  output_audio_format: 'Raw8KHz16BitMonoPcm', // 输出语音格式
  // output_audio_format: 'MonoMp3', // 备用格式（部分浏览器解码 MP3 可能延迟）
});
```
内置的agent是为客户定制化开发的，具备丰富的插件和知识库能力。同时为了保证用户自定义灵活度，内置的agent也支持用户自定义的提示词和个性化设置。以下是一个agent模板示例，用于定义 agent 的行为和个性化设置：
```javascript
export const instructions = `agent_template={幻星}//这是agent模板名称

    bot_info={
        你是小奇奇，一位聪慧可爱的知心好玩伴。
    }//助手信息，包含助手的角色、性格、身份等
    
    user_info={
        我叫轩轩，是11岁的男孩，生日：2013年11月7日
    }//用户信息，包含用户的角色、性格、身份等，如果不写助手会自动询问，并记录到长期记忆

    //如果没有可不写：
    extra_rules={
        1.请用“童言童语”，简单易懂的语言聊天；
    }//这是追加的全局回复要求（agent内置还调试好的要求，这里请尽量精简集中）

    extra_skills={
    词语造句：
        1. 造句必须包含给出的词语，只能是一个句子，不超过40字。
        2. 游戏开始，你先给出三个词语，我给出回复后，你给出你的答案，再给出新的三个词语。
    }//这是追加的纯prompt skills;
```

##### 可用的音频格式
- `Raw8KHz16BitMonoPcm`
- `Raw16KHz16BitMonoPcm`
- `Raw44100Hz16BitMonoPcm`
- `MonoMp3`

#### 消息发送方法

##### sendUserMessageContent(content)
发送用户文本消息，并自动生成回复。

```javascript
client.sendUserMessageContent([
  {
    type: 'input_text', // 普通文本，会经过模型处理
    // type: 'tts_text', // 直接调用语音合成，不经过大模型处理，可用于角色切换时播放提示，如“电量低……”等，例如：用户通过语音要求切换城的猪八戒，这时候需要猪八戒来提示
    text: "用户上线了，请根据聊天历史打个招呼或提问。",//每次重新连接，内置agent会自动恢复短期记忆，这里可以通过设置提示词来引导agent打招呼
  },
]);
```

##### appendInputAudio(arrayBuffer)
追加用户录入的语音数据到缓冲区（支持 Int16Array 或 ArrayBuffer）。

```javascript
const data = new Int16Array(2400);
client.appendInputAudio(data);
```

##### createResponse()
强制触发模型生成回复（当未开启 turn_detection 时，需要手动调用）。

```javascript
client.createResponse();
```

##### cancelResponse(id, sampleCount)
取消服务器正在生成的回复，并截断后续生成内容。

```javascript
// id 为正在生成回复的消息ID，sampleCount 为截断位置（单位：音频采样数）
const trackSampleOffset = await wavStreamPlayer.interrupt();
await client.cancelResponse(trackSampleOffset.trackId, trackSampleOffset.offset);
```

##### deleteItem(id)
删除指定的对话消息。

```javascript
client.deleteItem(itemId);
```

#### 事件处理

可通过以下事件监听对话与状态更新：
```javascript
// 连接错误
client.on('error', (event) => {
  console.error(event);
});

// 语音检测到用户中断（例如 VAD 模式下）
client.on('conversation.interrupted', async () => {
  // 处理中断，例如取消当前回复
});

// 对话内容更新（例如新增文字、语音片段或函数调用参数）
client.on('conversation.updated', ({ item, delta }) => {
  const items = client.conversation.getItems();
  // delta 可能包含:
  // delta.audio: 新增的音频 (Int16Array)
  // delta.transcript: 新增的文本转写
  // delta.arguments: 新增的函数调用参数
});

// 新消息添加
client.on('conversation.item.appended', ({ item }) => {
  // 消息状态为 in_progress 或 completed
});

// 消息完成
client.on('conversation.item.completed', ({ item }) => {
  // 消息状态必然为 completed
});
```

#### 辅助方法

##### waitForNextItem()
等待下一个 `conversation.item.appended` 事件。

```javascript
const { item } = await client.waitForNextItem();
```

##### waitForNextCompletedItem()
等待下一个 `conversation.item.completed` 事件。

```javascript
const { item } = await client.waitForNextCompletedItem();
```

## WavTools 工具库

### WavRecorder（录音器）

用于采集用户麦克风语音。

```javascript
import { WavRecorder } from '/src/lib/wavtools/index.js';

const wavRecorder = new WavRecorder({ sampleRate: 16000 });

// 请求权限并连接麦克风
await wavRecorder.begin();

// 开始录音，回调函数中返回音频数据（mono，raw 均为 Int16Array）
await wavRecorder.record((data) => {
  const { mono, raw } = data;
  client.appendInputAudio(mono);
});

// 暂停录音
await wavRecorder.pause();

// 保存录音文件（输出 WAV 格式）
const audio = await wavRecorder.save();

// 清理缓冲区并重新录音
await wavRecorder.clear();
await wavRecorder.record();

// 获取频谱数据（用于可视化）
const frequencyData = wavRecorder.getFrequencies();

// 停止录音并断开麦克风连接
const finalAudio = await wavRecorder.end();

// 监听设备变动（例如麦克风断线）
wavRecorder.listenForDeviceChange((deviceList) => {
  // 处理设备变化
});
```

### WavStreamPlayer（播放器）

用于播放 AI 生成的语音。

```javascript
import { WavStreamPlayer } from '/src/lib/wavtools/index.js';

const wavStreamPlayer = new WavStreamPlayer({ sampleRate: 8000 });

// 连接音频输出设备
await wavStreamPlayer.connect();

// 添加音频数据到队列（会立即开始播放）
wavStreamPlayer.add16BitPCM(audioData, 'track-id');

// 获取频谱数据（用于可视化）
const frequencyData = wavStreamPlayer.getFrequencies();

// 中断当前播放（返回中断位置等信息）
const trackOffset = await wavStreamPlayer.interrupt();
// trackOffset.trackId：中断的音轨ID
// trackOffset.offset：中断位置（采样点数）
// trackOffset.currentTime：中断时的音轨时间
```

## 完整示例

下面展示一个完整的语音对话示例：

```javascript
import { RealtimeClient } from 'realtime-api-beta-local';
import { WavRecorder, WavStreamPlayer } from './lib/wavtools/index.js';

// 初始化各组件
const wavRecorder = new WavRecorder({ sampleRate: 16000 });
const wavStreamPlayer = new WavStreamPlayer({ sampleRate: 8000 });
const client = new RealtimeClient({
  apiKey: apiKey,
  url: 'wss://api.xstar.city/v1/raltime',
  dangerouslyAllowAPIKeyInBrowser: true,
});

// 播放器事件设置：AI 播放时暂停录音，播放完毕后恢复
wavStreamPlayer.onplay = async () => {
  setIsBotSpeaking(true);
  if(wavRecorder.recording) {
    await wavRecorder.pause();
  }
};

wavStreamPlayer.onended = async () => {
  setIsBotSpeaking(false);
  if(!wavRecorder.recording && isConnectedRef.current)
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
};

// 客户端事件处理
client.on('error', (event) => console.error(event));

client.on('conversation.interrupted', async () => {
  const trackSampleOffset = await wavStreamPlayer.interrupt();
  if (trackSampleOffset?.trackId) {
    await client.cancelResponse(trackSampleOffset.trackId, trackSampleOffset.offset);
  }
});

client.on('conversation.updated', async ({ item, delta }) => {
  if (delta?.audio) {
    wavStreamPlayer.add16BitPCM(delta.audio, item.id);
  }
  
  if (item.status === 'completed' && item.formatted.audio?.length) {
    const sampleRate = item.role === 'user' ? 16000 : 8000;
    const wavFile = await WavRecorder.decode(
      item.formatted.audio,
      sampleRate,
      sampleRate
    );
    item.formatted.file = wavFile;
  }
  // 根据最新对话内容更新 UI
  setItems(client.conversation.getItems());
});

// 开始对话：连接 API、更新会话配置、发送首次问候
async function connectConversation() {
  await client.connect({ model: "qwen-max", userId: "user123" });
  
  client.updateSession({
    instructions: "请简短而有帮助地回答。",//非激活内置agent的提示词（不推荐）
    voice: '龙婉',
    turn_detection: { type: 'server_vad' },
    input_audio_format: 'Raw16KHz16BitMonoPcm',
    output_audio_format: 'Raw8KHz16BitMonoPcm',
  });
  
  client.sendUserMessageContent([{
    type: "input_text",
    text: "你好呀",
  }]);
  
  // 连接音频设备
  await wavRecorder.begin();
  await wavStreamPlayer.connect();
  
  // 开始采集录音
  await wavRecorder.record((data) => client.appendInputAudio(data.mono));
}

// 结束对话：断开连接并释放资源
async function disconnectConversation() {
  client.disconnect();
  await wavRecorder.end();
  await wavStreamPlayer.interrupt();
}
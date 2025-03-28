# xStar 实时语音调试客户端

> OpenAI Realtime API 平替接口，支持定制agent、国内模型和自定义音色

## 概述

本项目是一个用于调试和参考 xStar realtime API 的交互式网页工具，实现实时语音对话。它内置了两个工具库：
- [openai/openai-realtime-api-beta](https://github.com/gpww/openai-realtime-api-beta) —— 浏览器及 Node.js 用参考客户端
- [`/src/lib/wavtools`](./src/lib/wavtools) —— 浏览器端音频操作工具

## 重要说明

- 本仓库已将 https://github.com/gpww/openai-realtime-api-beta 添加为子模块，相比 OpenAI 原版，支持定制agent+国内模型+音色的自定义修改
- 本仓库仅用于调试和参考，不适用于生产环境，浏览器兼容性（特别是手机端）可能存在问题
- 本仓库的代码可能存在错误和问题，您使用本仓库的代码时，应自行承担风险

### 参考SDK

- iOS设备SDK: [swift-realtime-openai](https://github.com/m1guelpf/swift-realtime-openai)
- Python SDK: [示例文章](https://medium.com/thedeephub/building-a-voice-enabled-python-fastapi-app-using-openais-realtime-api-bfdf2947c3e4)
- C# SDK: [Azure样例](https://github.com/Azure-Samples/aoai-realtime-audio-sdk)
- Java SDK: [Simple OpenAI](https://github.com/sashirestela/simple-openai?tab=readme-ov-file#using-realtime-feature)
- WebSocket事件文档: [OpenAI文档](https://platform.openai.com/docs/guides/realtime-conversations#handling-audio-with-websockets)

## 内置功能特性

本项目内置了多种功能插件，用于增强会话体验：

1. **BrainTwister**: When you need to generate a riddle, please use the plugin to fetch it from the database instead of creating it yourself. However, when answering riddles posed by others, there is no need to call this plugin. Do not include the answer when you pose a riddle; provide it only if the user can't figure it out. Also, note that riddles do not have a single correct answer, so other reasonable answers are acceptable. Be aware that the input text comes from speech recognition, which may result in errors with words that have similar pronunciations. In such cases, answers with similar sounds are also correct. If it's an English riddle, please present it in its original English form WITHOUT translation.

2. **IdiomChain**: 在需要成语接龙语境下，请调用该插件（并不是所有场景下说成语都接龙，要根据上下文判断）。如果是你先说，请调用GetRandomIdiom。如果需要接续，请调用GetNextIdiom。如果接不上请参考函数返回提示。【4字成语大全】收录成语54,089个，剔除不可接或者被接的成语后，剩余46,464个成语。

3. **MathGamePlugin**: 这是一个数字游戏插件，经典的24点游戏也可以通过这个插件实现。给定最多6个整数，通过四则运算计算出目标值。插件可以找到所有可能的运算方法。解释运算方法的时候，请列出中间结果方便用户理解。例如解释 (5-(9/3))*12 = 24 的时候可以解释成：先用5-9/3=2，再用2*12=24。请不要输出Latex公式，也不要分点，这样会导致语音合成混乱。

4. **MusicPlugin**: 可以随机播放唱歌的歌曲，或者轻音乐。

5. **SoundGame**: 该插件可以让用户听到各种声音（请不要说播放声音，可以结合语境说得诗意一些）。内置2300+声音片段，主要包括人类声音、动物声音、物体声音、音乐声音和自然声音这五大类声音类型。其中人类声音包括人声、呼吸声等；动物声音涉及家养和野生动物；物体声音包括车辆、机械等人造物品的声音；音乐声音涵盖了乐器、音乐风格等；自然声音则包括风、雷、水等自然现象产生的声音。

6. **SpeechPlugin**: SpeechPlugin 插件提供了一系列语音合成功能，允许用户控制语音播放的各种参数。主要语义函数包括：
   - **AdjustVoiceSpeed**：根据用户要求调整语速
   - **SwitchVoice**：切换语音角色（当用户明确要求时）
   - **CloneVoice**：当用户要求克隆当前语音的时候调用，切换语音的时候不要调用语音克隆。一个用户只能克隆一个音色，保存为名字叫"克隆语音"的角色，再次克隆会覆盖之前的版本
   - **DeepThinkingMode**：当用户明确要求以深度思考模式来回答时候调用
   - **WebSearchMode**：上网/联网搜索来回答用户问题
   - **StartSimultaneousTranslation**：可启动进入语音同传翻译模式（当用户明确要求时），支持多语言间的实时翻译，并可以检测退出模式的请求

7. **UtilsPlugin**: 工具插件，用于需要语义函数的地方

8. **WeatherWatch**: 查询中国372个地区（包括州、省、市、县、特别行政区、盟、旗）和1011个市内区（例如：深圳市南山区）的天气。可查询当日实时天气情况，和未来3天的天气预报。数据来源是中国气象局。实况天气每小时更新多次，预报天气每天更新3次，分别在8、11、18点左右更新。

## 快速入门

### 安装

该项目使用 create-react-app 搭建，并通过 Webpack 打包：

```shell
$ npm i
```

### 配置

1. 将 `.env.example` 复制为 `.env`  
2. 在 `.env` 中填入 `REACT_APP_OPENAI_API_KEY`
   > API Key 可在 https://www.xstar.city/rag/ 获取

### 启动

```shell
$ npm start
```

网页客户端运行在 `localhost:4001`

## API 接口文档

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

### 连接与会话管理

#### connect(options)

建立 WebSocket 连接并启动对话。

```javascript
await client.connect({ 
  model: "qwen-max@DashScope", // 或其他模型ID
  userId: "user123" // 可选用户标识
});
```

> **注意**：用户标识是区分聊天context的关键，否则不同用户会混淆。对于单用户账号，一个apikey会对应一个用户标识。因此这里可以忽略掉。但是对于企业用户，一个apikey可能会对应多个用户标识。为了避免不同用户的聊天context混淆，建议每个用户都使用不同的userId。

模型可以指定为：
- 单个 modelId（自动路由多个供应商）
- modelId@provider（指定供应商）

完整模型列表请查看：https://api.xstar.city/v1/models

#### disconnect()

断开 API 连接，并清除对话历史。

```javascript
client.disconnect();
```

#### isConnected() / waitForSessionCreated()

```javascript
const connected = client.isConnected(); // 返回连接状态和会话是否已启动
await client.waitForSessionCreated(); // 等待服务器发出 session.created 事件
```

### 会话配置

#### updateSession(sessionConfig)

更新会话配置，例如提示词、语音、音频格式等。

```javascript
client.updateSession({
  instructions: instructions, // 可配置agent模板提示词，这种方式激活内置agent（with 灵活定义的用户参数）
  voice: '龙婉', // 语音名称，完整列表见 https://api.xstar.city/v1/realtime/voiceList
  turn_detection: { type: 'server_vad' }, // 语音活动检测（默认按语音片段识别）
  input_audio_format: 'Raw16KHz16BitMonoPcm', // 用户输入语音格式
  output_audio_format: 'Raw8KHz16BitMonoPcm', // 输出语音格式
  // output_audio_format: 'MonoMp3', // 备用格式（部分浏览器解码 MP3 可能延迟）
});
```

#### Agent模板示例

内置的agent是为客户定制化开发的，具备丰富的插件和知识库能力。同时为了保证用户自定义灵活度，内置的agent也支持用户自定义的提示词和个性化设置：

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
        1.请用"童言童语"，简单易懂的语言聊天；
    }//这是追加的全局回复要求（agent内置还调试好的要求，这里请尽量精简集中）

    extra_skills={
    词语造句：
        1. 造句必须包含给出的词语，只能是一个句子，不超过40字。
        2. 游戏开始，你先给出三个词语，我给出回复后，你给出你的答案，再给出新的三个词语。
    }//这是追加的纯prompt skills;
```

#### 可用的音频格式

- `Raw8KHz16BitMonoPcm`
- `Raw16KHz16BitMonoPcm`
- `Raw44100Hz16BitMonoPcm`
- `MonoMp3`

### 消息发送与处理

#### sendUserMessageContent(content)

发送用户文本消息，并自动生成回复。

```javascript
client.sendUserMessageContent([
  {
    type: 'input_text', // 普通文本，会经过模型处理
    // type: 'tts_text', // 直接调用语音合成，不经过大模型处理，可用于角色切换时播放提示，如"电量低……"等
    text: "用户上线了，请根据聊天历史打个招呼或提问。", // 每次重新连接，内置agent会自动恢复短期记忆，这里可以通过设置提示词来引导agent打招呼
  },
]);
```

#### appendInputAudio(arrayBuffer)

追加用户录入的语音数据到缓冲区（支持 Int16Array 或 ArrayBuffer）。

```javascript
const data = new Int16Array(2400);
client.appendInputAudio(data);
```

#### createResponse() / cancelResponse() / deleteItem()

```javascript
// 强制触发模型生成回复（当未开启 turn_detection 时，需要手动调用）
client.createResponse();

// 取消服务器正在生成的回复，并截断后续生成内容
const trackSampleOffset = await wavStreamPlayer.interrupt();
await client.cancelResponse(trackSampleOffset.trackId, trackSampleOffset.offset);

// 删除指定的对话消息
client.deleteItem(itemId);
```

### 事件监听

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

### 辅助方法

```javascript
// 等待下一个消息添加事件
const { item } = await client.waitForNextItem();

// 等待下一个消息完成事件
const { item } = await client.waitForNextCompletedItem();
```

## 音频工具库

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

下面展示一个完整的语音对话实现：

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
    instructions: "请简短而有帮助地回答。", // 非激活内置agent的提示词（不推荐）
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
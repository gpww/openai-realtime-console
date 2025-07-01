# xStar 实时语音Agent

> OpenAI Realtime API 平替接口 https://api.xstar.city/ 支持定制agent、国内llm 和 自定义音色。
> 支持低延迟、多模态交互：包括语音对话、实时转写和语音合成。
> 支持自由打断（非唤醒词），连续语音打断（检测到用户连续说话）和语义打断（通过语义判断用户表达的意思是否请求打断）。
> 支持交互式语音克隆：直接说出“克隆我的声音”，即可将当前语音克隆为新的音色，支持多次克隆覆盖。
> 支持多国语言角色切换和同传翻译模式
> 支持多模态RAG和知识图谱，Agent短期，长期记忆

可以通过两种方式连接 xStar Realtime API：

- 使用 WebRTC，适用于客户端应用（如网页、嵌入式端），Demo: http://v.xstar.city/ 和 http://talk.xstar.city/
- 使用 WebSocket，适用于服务端到服务端应用，Demo：https://chat.xstar.city/

## 概述

本项目是一个用于调试和参考 xStar realtime API 的交互式网页工具，实现实时语音对话。

👉 [WebRTC 纯JS极简示例代码（openai-webrtc-test）](./openai-webrtc-test.html)

WebSocket版本内置了两个工具库：
- [openai/openai-realtime-api-beta](https://github.com/gpww/openai-realtime-api-beta) —— 浏览器及 Node.js 用参考客户端
- [`/src/lib/wavtools/nativeAudio.js`](./src/lib/wavtools/nativeAudio.js) —— 浏览器端原生音频操作工具（替换OpenAI原版wavtools以解决兼容性问题）


## 重要说明

- 本仓库已将 https://github.com/gpww/openai-realtime-api-beta 添加为子模块，相比 OpenAI 原版，支持定制agent+国内模型+音色的自定义修改
- 网页示例仅用于调试和参考

### 参考SDK

- iOS设备SDK: [swift-realtime-openai](https://github.com/m1guelpf/swift-realtime-openai)
- Python SDK: [示例文章](https://medium.com/thedeephub/building-a-voice-enabled-python-fastapi-app-using-openais-realtime-api-bfdf2947c3e4)
- C# SDK: [Azure样例](https://github.com/Azure-Samples/aoai-realtime-audio-sdk)
- Java SDK: [Simple OpenAI](https://github.com/sashirestela/simple-openai?tab=readme-ov-file#using-realtime-feature)
- WebSocket事件文档: [OpenAI文档](https://platform.openai.com/docs/guides/realtime-conversations#handling-audio-with-websockets)

## 内置功能特性

内置 Demo Agent "幻星" 内置了多种功能插件，用于增强会话体验：

1. **MemoryPlugin（长期记忆与短期记忆）**  
   - **短期记忆**：每次用户上线时，agent 会自动恢复最近的聊天上下文，保证对话的连贯性。  
   - **长期记忆**：agent 会尽量记住用户的以下类型信息，持续优化个性化体验：  
     1. 个人偏好（食物、饮品、娱乐、艺术、音乐、品牌等喜好或厌恶）
     2. 个人详情（姓名、关系、生日、纪念日等重要日期）
     3. 计划和意图（即将发生的事件、旅行、目标和任何短期或长期计划）
     4. 活动和服务习惯（就餐、旅行、购物、休闲习惯和偏好）
     5. 健康信息（饮食限制、锻炼习惯、过敏、健康目标等）
     6. 职业信息（职位、工作习惯、工作环境、职业目标等）
     7. 兴趣爱好（书籍、电影、运动、收藏等个人兴趣）

2. **SpeechPlugin**: SpeechPlugin 插件提供了一系列语音合成功能，允许用户控制语音播放的各种参数。主要语义函数包括：
   - **AdjustVoiceSpeed**：根据用户要求调整语速，比如说快点？慢点？
   - **SwitchVoice**：切换语音角色（当用户明确要求时）完整列表见 https://api.xstar.city/v1/realtime/voiceList
   - **CloneVoice**：交互式语音克隆，切换语音的时候不要调用语音克隆。一个用户只能克隆一个音色，保存为名字叫"克隆语音"的角色，再次克隆会覆盖之前的版本
   - **DeepThinkingMode**：当用户明确要求以深度思考模式来回答时候调用
   - **WebSearchMode**：上网/联网搜索来回答用户问题
   - **StartSimultaneousTranslation**：可启动进入语音同传翻译模式（当用户明确要求时），支持多语言间的实时翻译，并可以检测退出模式的请求

3. **MusicPlugin**: 可以随机播放唱歌的歌曲，或者轻音乐。

4. **SoundGame**: 该插件可以让用户听到各种声音（请不要说播放声音，可以结合语境说得诗意一些）。内置2300+声音片段，主要包括人类声音、动物声音、物体声音、音乐声音和自然声音这五大类声音类型。其中人类声音包括人声、呼吸声等；动物声音涉及家养和野生动物；物体声音包括车辆、机械等人造物品的声音；音乐声音涵盖了乐器、音乐风格等；自然声音则包括风、雷、水等自然现象产生的声音。

5. **WeatherWatch**: 查询中国372个地区（包括州、省、市、县、特别行政区、盟、旗）和1011个市内区（例如：深圳市南山区）的天气。可查询当日实时天气情况，和未来3天的天气预报。数据来源是中国气象局。实况天气每小时更新多次，预报天气每天更新3次，分别在8、11、18点左右更新。

6. **MathGamePlugin**: 这是一个数字游戏插件，经典的24点游戏也可以通过这个插件实现。给定最多6个整数，通过四则运算计算出目标值。插件可以找到所有可能的运算方法。解释运算方法的时候，请列出中间结果方便用户理解。例如解释 (5-(9/3))*12 = 24 的时候可以解释成：先用5-9/3=2，再用2*12=24。请不要输出Latex公式，也不要分点，这样会导致语音合成混乱。

7. **BrainTwister**: When you need to generate a riddle, please use the plugin to fetch it from the database instead of creating it yourself. However, when answering riddles posed by others, there is no need to call this plugin. Do not include the answer when you pose a riddle; provide it only if the user can't figure it out. Also, note that riddles do not have a single correct answer, so other reasonable answers are acceptable. Be aware that the input text comes from speech recognition, which may result in errors with words that have similar pronunciations. In such cases, answers with similar sounds are also correct. If it's an English riddle, please present it in its original English form WITHOUT translation.

8. **IdiomChain**: 在需要成语接龙语境下，请调用该插件（并不是所有场景下说成语都接龙，要根据上下文判断）。如果是你先说，请调用GetRandomIdiom。如果需要接续，请调用GetNextIdiom。如果接不上请参考函数返回提示。【4字成语大全】收录成语54,089个，剔除不可接或者被接的成语后，剩余46,464个成语。

## 快速入门

### 安装

WebSocket版本的网页示例使用 create-react-app 搭建，并通过 Webpack 打包：

```shell
$ npm i
```

### 配置

1. 将 `.env.example` 复制为 `.env`  
2. 在 `.env` 中填入 `REACT_APP_OPENAI_API_KEY`
   > API Key 联系xstar获取

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
  output_audio_format: 'Raw24KHz16BitMonoPcm', // 输出语音格式
  // output_audio_format: 'MonoMp3', // 备用格式（部分浏览器解码 MP3 可能延迟）
});
```

#### Agent模板示例

内置的agent是为客户定制化开发的，具备丰富的插件和知识库能力。同时为了保证用户自定义灵活度，内置的agent也支持用户自定义的提示词和个性化设置：

```javascript
export const instructions = `agent_template={幻星}//这是agent模板名称

    bot_info={
        你是幻星，一位聪慧可爱的知心好玩伴。
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
- `Raw24KHz16BitMonoPcm` // 添加24kHz格式
- `Raw44100Hz16BitMonoPcm`
- `MonoMp3`
- `Audio16KHz16BitMonoOpus`

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
await audioPlayer.interrupt(); // 修正为使用nativeAudio的interrupt方法
await client.cancelResponse(); // 简化调用，不需要trackId参数

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

> **重要说明**：由于OpenAI原版的wavtools在某些浏览器和移动设备上存在兼容性问题，我们已替换为基于Web Audio API的原生音频处理库`nativeAudio.js`，提供更好的兼容性和性能。

### NativeAudioRecorder（录音器）

用于采集用户麦克风语音，支持回声消除。

```javascript
import { NativeAudioRecorder } from '/src/lib/wavtools/nativeAudio.js';

const audioRecorder = new NativeAudioRecorder({ 
  recordingSampleRate: 16000, 
  channels: 1 
});

// 请求权限并连接麦克风（内置回声消除）
await audioRecorder.begin();

// 开始录音，回调函数中返回音频数据（mono为Int16Array）
await audioRecorder.record((data) => {
  const { mono } = data;
  client.appendInputAudio(mono);
});

// 暂停录音
await audioRecorder.pause();

// 获取频谱数据（用于可视化）
const frequencyData = audioRecorder.getFrequencies();

// 检查录音状态
const isRecording = audioRecorder.recording;

// 停止录音并释放资源
await audioRecorder.end();
```

### NativeAudioPlayer（播放器）

用于播放AI生成的语音，支持流式播放。

```javascript
import { NativeAudioPlayer } from '/src/lib/wavtools/nativeAudio.js';

const audioPlayer = new NativeAudioPlayer({ 
  playbackSampleRate: 24000, 
  channels: 1 
});

// 连接音频输出设备
await audioPlayer.connect();

// 添加音频数据到队列（会立即开始播放）
audioPlayer.add16BitPCM(audioData, 'track-id');

// 获取频谱数据（用于可视化）
const frequencyData = audioPlayer.getFrequencies();

// 中断当前播放
await audioPlayer.interrupt();

// 设置播放事件回调
audioPlayer.onplay = () => {
  console.log('开始播放');
};

audioPlayer.onended = () => {
  console.log('播放结束');
};
```

## 完整示例

下面展示一个完整的语音对话实现：

```javascript
import { RealtimeClient } from 'realtime-api-beta-local';
import { NativeAudioRecorder, NativeAudioPlayer } from './lib/wavtools/nativeAudio.js';

// 初始化各组件（注意录制和播放使用不同采样率）
const audioRecorder = new NativeAudioRecorder({ recordingSampleRate: 16000, channels: 1 });
const audioPlayer = new NativeAudioPlayer({ playbackSampleRate: 24000, channels: 1 });
const client = new RealtimeClient({
  apiKey: apiKey,
  url: 'wss://api.xstar.city/v1/raltime',
  dangerouslyAllowAPIKeyInBrowser: true,
});

// 播放器事件设置：显示播放状态
audioPlayer.onplay = async () => {
  setIsBotSpeaking(true);
};

audioPlayer.onended = async () => {
  setIsBotSpeaking(false);
};

// 客户端事件处理
client.on('error', (event) => console.error(event));

client.on('conversation.interrupted', async () => {
  await audioPlayer.interrupt();
  await client.cancelResponse();
});

client.on('conversation.updated', async ({ item, delta }) => {
  if (delta?.audio) {
    // nativeAudio直接处理Int16Array音频数据
    audioPlayer.add16BitPCM(delta.audio, item.id);
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
    output_audio_format: 'Raw24KHz16BitMonoPcm', // 播放采样率可以设置为24kHz
  });
  
  client.sendUserMessageContent([{
    type: "input_text",
    // type: "tts_text", // 如果需要直接语音合成，可以使用这个类型
    text: "你好呀",
  }]);
  
  // 连接音频设备
  await audioRecorder.begin();
  await audioPlayer.connect();
  
  // 开始采集录音
  await audioRecorder.record((data) => client.appendInputAudio(data.mono));
}

// 结束对话：断开连接并释放资源
async function disconnectConversation() {
  client.disconnect();
  await audioRecorder.end();
  await audioPlayer.interrupt();
}
```

### nativeAudio vs 原版wavtools的主要改进

1. **更好的兼容性**：基于标准Web Audio API，支持更多浏览器和移动设备
2. **内置回声消除**：录音器自动启用回声消除，提供更清晰的语音输入
3. **分离采样率配置**：支持录制和播放使用不同采样率（16kHz录制，24kHz播放）
4. **简化的API**：移除了复杂的音频解码和文件处理，专注于实时音频流
5. **更好的性能**：使用AudioWorklet处理音频，减少主线程阻塞
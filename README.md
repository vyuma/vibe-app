# Vibe

## Web版をVercelへ公開する

このリポジトリをVercelにインポートすると、`vercel.json`に従って`npm ci` → `npm run build:web`が実行され、`dist`が公開されます。Expoの静的出力を使うため、全ページを`/`へrewriteする設定は不要です。

公開URLをPosture側の環境変数`VIBE_PUBLIC_URL`に設定してください。Vibe側にRedisの認証情報や固定のPosture URLは不要です。PostureのQRに含まれる`relay`・`room`・`token`で接続先を受け取ります。

PCのQRをiPhoneのカメラで開き、「通知を有効にして接続」を押してください。iPhoneのブラウザでは音と画面で通知します。測定中はページを開いたままにしてください。ネイティブ版のLAN接続・振動機能も引き続き利用できます。

Webビルド: `npm run build:web`。URL解析・通信形式のテスト: `bun run test:pairing`。

Posture側の設定とRedisの準備は、`posture-app/docs/browser-deployment.md`に記載しています。

## Expoの開発環境

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.





** npx expo install @react-native-async-storage/async-storage **

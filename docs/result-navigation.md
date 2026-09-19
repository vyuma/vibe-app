# 獲得画面の共有アイコンと戻る操作

参照: Figma `プロトタイプ` の `獲得`、580:7077。共有アイコン: 580:7110。

## 変更

- 共有ボタンをFigmaの原本SVG (`assets/images/acquisition-share.svg`) に差し替えた。円背景込みの40×40を表示し、背景の二重描画をなくした。
- 新規獲得: 上部の「戻る」に加えてカード下に「ホームに戻る」を表示。
- コレクションから開いた詳細: 既存CharacterInfoModalを再利用。ホームを背面に残す半透明背景のシートで、ヘッダー「閉じる」または背景タップで閉じる。共有アイコンも同じ原本SVGに統一。
- どちらも既存モーダルのonCloseを呼ぶ。ルート遷移やペアリング解除、保存データの変更は行わない。
- Safe Areaに応じてヘッダーを下げ、短い画面では外側ScrollViewから下部操作にアクセスできる。
- カードだけを画像共有する既存キャプチャ範囲を維持。戻る操作は共有画像に含まれない。

## 確認

ローカルの一時プレビューで実際のAcquisitionResultModalを表示して確認（一時ルートは削除済み）。

| 条件 | 結果 |
| --- | --- |
| 390×844、共有アイコン | x=310、y=62、40×40。Figmaとの差0px。原本SVG表示を確認 |
| 390×844、新規獲得 | 下部「ホームに戻る」でモーダル終了 |
| コレクション詳細（変更後） | 390×844で「閉じる」→再表示を確認。閉じる45×44px。320×568でも45×44px、844×390でもヘッダーが画面内 |
| 320×568 | 戻るボタン48×44、下部ボタン254.35×48。スクロール後に押して終了できる |
| 844×390 | 中央カラムとヘッダー表示、下部へのスクロールとモーダル終了を確認 |

今回の一致確認対象は共有アイコンと追加した戻る動線。カード本体の既存画像・色・フォント・余白は変更していないため、画面全体がFigmaと完全一致したという判定ではない。

iPhone実機でのSVG表示、Safe Area、画像共有シート、実際のホーム一覧スクロール位置の保持は新しいTestFlightビルドで確認が必要。既存のTestFlight 1.0.0 (3)には今回のUI変更は入っていない。

## コレクション詳細モーダル追加確認

一時プレビューでCharacterInfoModalを表示し、390×844・320×568・844×390の閉じる操作の位置を確認。高さは画面の88%かSafe Area内の利用可能高さの小さい方に制限。カード領域は既存ScrollViewを維持。背景タップは実装済みだがブラウザ自動操作では閉じたことを確認できず、実機確認対象とする。小画面での最下部までのスクロール、実際のホーム一覧の位置保持、iOS共有も未検証。lint・TypeScript検査は通過。

## TestFlight 1.0.0 (4)

2026-09-19、`fix/mobile-result-navigation` の作業ツリー（ベース `f4e2d6e`、上記未コミットUI変更を含む）からproductionビルドを送信。

- 作業フォルダ: `/Users/kyoungpin/Desktop/01_coding/14hack1/vibe-app`
- 実行: `npx --yes eas-cli@latest build --platform ios --profile production --auto-submit --non-interactive`
- Build: https://expo.dev/accounts/kyoung9/projects/vibe-app/builds/2d107506-c5f7-48f5-be81-05cea868726c
- Submission: https://expo.dev/accounts/kyoung9/projects/vibe-app/submissions/6bca59dc-8328-4183-9ac0-2761f25be2f7
- lint、TypeScript、pairing 5件、contracts 2件、diff whitespace検査通過。
- 実機確認: TestFlightで(4)へ更新し、保存済みカード→詳細→「閉じる」→ホーム、背景タップ、小画面の最下部スクロール、共有画像を確認。続いてPCで新規測定を終了し、全画面の獲得表示→「ホームに戻る」→保存済みカードを確認する。Metroは停止したまま実施。
- ビルド・アップロードの成功とiPhoneでの動作確認は別として記録する。

配布実行結果: EASのiOSビルド成功、App Store Connectへのアップロード成功をCLIで確認。Apple側の処理完了・テスターの更新インストール・iPhone実機UI確認は、この時点では未確認。

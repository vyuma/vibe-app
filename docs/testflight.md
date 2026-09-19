# PiiiN iPhone 팀 배포 및 연동 검증

## 단계별 진행 상태

1. **배포 우선:** production 설정·내부 QR 페어링·번들/로컬 검사는 준비됨. Expo 프로젝트 및 Apple 앱 생성, 코드 연결, EAS CLI 로그인 완료. 사용자 Apple 인증 후 production iOS 서명 빌드 **1.0.0 (2)** 완료. 1.0.0 (2)의 App Store Connect 업로드 완료. 아이콘 변경 빌드 1.0.0 (3)은 빌드 및 Apple 업로드·처리 완료, 내부 Team (Expo) 그룹 배정 확인. TestFlight 설치·iPhone 실검증은 미완료.
2. **데이터 정합성:** 7종 캐릭터 공유 필드·순서·이미지 SHA-256 일치 확인. 구 ID 별칭 7개를 양쪽에 맞추고 Rust 선택 필드를 null 대신 생략하도록 수정했다. 잠금·단절·PC 재시작 이후 결과 복구와 늦은 종료 방어를 추가했다. 상세 내용은 [잠금 중 종료 검증](locked-completion.md)을 따른다.
3. **기본 카메라:** vibeapp scheme과 cold/warm 링크 변환 코드는 준비됨. 기본 카메라가 실제 설치 앱을 열고 연결하는 검증은 iPhone에서 해야 한다.

작업 브랜치: 모바일 `fix/testflight-lan-integration`, PC `fix/mobile-state-sync`. 기존 미커밋 변경을 보존한 상태로 main에서 분리했다.

## 상태와 작업 기준

2026-09-19 기준. **코드·로컬 검사 완료와 TestFlight 실기기 검증은 별개다. 아래 실기기 검증표를 통과하기 전에는 팀 사용 완료로 보지 않는다.**

- 모바일: `/Users/kyoungpin/Desktop/01_coding/14hack1/vibe-app`, 작업 시작 `a52dac9db10ef8b3a20e8cfb4503943f72d363a3`, Expo SDK 54 / 앱 버전 1.0.0.
- PC: `/Users/kyoungpin/Desktop/01_coding/14hack1/posture-app`, 연동 구현 PR [#20](https://github.com/vyuma/posture-app/pull/20), 배포 버전 0.1.3.
- PiiiN 웹 저장소는 수정하지 않았다. 레거시 페어링 구현을 참고해 데스크톱에 필요한 프로토콜만 이식했다.
- 팀원 PC는 [PiiiN v0.1.3](https://github.com/vyuma/posture-app/releases/tag/v0.1.3)으로 업데이트해야 한다. 기존 앱의 자동 업데이트 또는 공증된 Universal DMG를 사용한다.
- 계정 확인: Apple Developer 팀 `XR3N5USJR9`에 사용자 승인된 모바일 Explicit App ID `com.kyoungpin.piiin`(설명: PiiiN Mobile)을 등록하고 app.json에 반영했다. 기존 KOKURI ID는 재사용하지 않는다.
- App Store Connect: 사용자 이용약관 동의 후 `PiiiN` iOS 앱을 생성했다. Apple ID `6813624120`, SKU `com.kyoungpin.piiin`, 기본 언어는 사용자 지정 **일본어**다. eas.json의 submit.production.ios.ascAppId에 연결했다. 1.0.0 (2) 업로드 완료를 EAS Submit 성공 로그로 확인했다. Apple 처리 및 설치 결과는 별도 확인한다.
- Expo: 사용자 로그인 후 `kyoung9` 계정에 `vibe-app` 프로젝트를 생성했다. 실제 발급 UUID `185f4a2a-d1d7-402b-86e4-e27c16de7d84`와 owner를 app.json에 반영했다. [프로젝트](https://expo.dev/accounts/kyoung9/projects/vibe-app). 브라우저 로그인과 로컬 EAS CLI 로그인은 별개다.
- 기존 scheme `vibeapp`, slug/name `vibe-app` 유지. iPhone 홈 화면 표시 이름도 현재 설정상 `vibe-app`이다.
- 최신 EAS 빌드: `cca429be-d4db-4eb4-b9be-eb6271f60acc`, `FINISHED`, iOS 실기기/STORE/production, `com.kyoungpin.piiin`, 1.0.0 (3). [빌드 상세](https://expo.dev/accounts/kyoung9/projects/vibe-app/builds/cca429be-d4db-4eb4-b9be-eb6271f60acc). 실기기 결과와 구분한다.

## 구조와 변경

TestFlight 앱에는 JS·이미지·소리가 포함된다. 실행 시 Expo Go/Metro/개발 실행 QR은 필요 없다. 빌드 과정에서 Metro가 번들을 만드는 것은 정상이다. 페어링 QR은 그대로 사용한다.

PC 앱이 켜진 상태에서 같은 LAN의 iPhone이 QR에 담긴 PC IP/임의 포트로 `/pair`, `/ws`, `/disconnect`에 직접 연결한다. 공용 런타임 서버나 EAS Update는 도입하지 않는다. EAS는 빌드·업로드 용도다.

| 파일 | 변경 이유 |
| --- | --- |
| `eas.json` | production = store 배포, Release, 실기기, developmentClient=false, 원격 buildNumber 자동 증가 |
| `app.config.js` | 실제 Bundle ID / 프로젝트 ID를 환경변수 또는 app.json에서 사용하고 production 누락 시 실패 |
| `app.json` | 로컬 네트워크 권한 설명, 카메라 플러그인, ATS 로컬·사설 IPv4 예외 |
| `app/+native-intent.tsx`, `app/(tabs)/index.tsx`, `app/pairing-test.tsx` | 홈 아이콘으로 연결 화면 진입, cold/warm 페어링 링크를 기존 QR 연결 경로로 전달, 이전 연결 복원과 충돌 방지 |
| `hooks/usePairingSession.ts`, `lib/pairing/*` | 이전 소켓 교체, HTTP timeout, heartbeat 응답 확인, 저장 후 ACK, 순차 저장·중복 방지, snapshot 자세 상태 복원 |
| `package.json`, `tests/pairing.test.cjs` | npm lockfile과 맞지 않던 Yarn packageManager 선언 제거, 회귀 검사 |
| PC `src/App.tsx`, `desktopBridge.ts` | 실제 측정/등록 단계 및 보상 판정 결과를 Tauri 명령에 연결 |
| PC `src-tauri/src/commands/pairing_commands.rs`, `pairing/{mod,types,state,server}.rs`, `lib.rs` | 확장 이벤트·snapshot·ACK 대기열·재전송, TCP 분할/합쳐진 ACK 수신, heartbeat, 통합 테스트 |

기존 개발 경로는 `npm start` + Expo Go다. 작업 전 EAS development 프로필과 expo-dev-client는 없었다. 불필요한 development client 의존성을 새로 넣지 않았다. TestFlight에 `distribution: internal`(Ad Hoc)을 사용하지 않는다.

## Apple / Expo 소유자가 한 번 설정할 것

1. Apple Developer의 실제 팀을 선택하고 앱 전용 **Explicit App ID / Bundle ID**를 생성하거나 기존 ID를 확인한다. 이름만 보고 다른 앱의 ID를 재사용하지 않는다.
2. App Store Connect → Apps → 새 iOS 앱을 만들고 같은 Bundle ID를 선택한다. 앱 이름, 기본 언어, SKU는 소유자가 정한다. 생성된 숫자 Apple ID(ascAppId)를 기록한다.
3. Expo 계정/조직에서 이 모바일 앱의 EAS 프로젝트를 생성하거나 기존 프로젝트를 확인한다. UUID와 owner를 확인한다. Apple ID와 Expo UUID는 서로 다르다.
4. 모바일 `app.json`의 `expo.ios.bundleIdentifier`, `expo.extra.eas.projectId`, 필요 시 `expo.owner`에 **실제 값**을 추가한다. 이 세 식별자는 비밀이 아니며 팀이 같은 프로젝트를 빌드하도록 공유할 수 있다. `IOS_BUNDLE_IDENTIFIER`, `EAS_PROJECT_ID` 환경변수도 지원하지만 로컬만 설정하면 원격 빌드에서 사라지므로 환경변수 방식이면 EAS production 환경에도 같은 값을 등록한다.
5. 아래 폴더에서 Expo 로그인 후 `project:info`가 올바른 프로젝트를 가리키는지 확인한다. 동적 config 때문에 CLI가 자동 수정하지 못하면 4번을 직접 수정한다.

```sh
cd /Users/kyoungpin/Desktop/01_coding/14hack1/vibe-app
npm ci
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest project:info
npx expo config --type public
```

이미 연결된 프로젝트 UUID를 바꾸지 않는다. 새 프로젝트의 UUID를 app.json에 넣으면 연결된다. CLI로 프로젝트를 생성하려면 `npx eas-cli@latest init`의 실제 계정/프로젝트 선택 결과를 확인하고 반환된 UUID를 app.json에 넣는다.

6. App Store Connect의 `eas.json` → `submit.production.ios.ascAppId`에 실제 숫자 Apple ID를 **문자열**로 설정하거나 제출 CLI에서 앱을 직접 선택한다. 자동 선택 결과를 반드시 확인한다.
7. 최초 빌드에서 올바른 Apple Team으로 로그인하고 EAS의 Apple Distribution 인증서/App Store provisioning profile 생성·사용을 승인한다. 유료 프로그램 가입만으로 모든 구성원의 서명 권한이 생기는 것은 아니다. 기존 인증서를 임의 폐기하지 않는다. 비밀번호, 2FA, `.p8`, `.p12`, provisioning profile은 코드·문서·대화에 넣지 않는다.
8. Apple 계약 동의와 export compliance 질문은 계정 소유자가 실제 암호화 사용 내역에 따라 답한다. 2026-09-19 사용자가 EAS의 표준/면제 암호화 질문에 Yes를 승인했고, CLI가 `ITSAppUsesNonExemptEncryption=false`를 app.json에 반영했다. 암호화 기능이 바뀌면 재검토한다.

## 검사 → 빌드 → 업로드

```sh
cd /Users/kyoungpin/Desktop/01_coding/14hack1/vibe-app
npm run lint
npx tsc --noEmit
npm run test:pairing
npm run test:contracts
npx expo export --platform ios --output-dir /tmp/piiin-ios-export
npx expo config --type introspect
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

submit에서 방금 생성된 **해당 앱의 production 빌드**를 선택한다. 무조건 `--latest`를 써서 다른 작업의 빌드를 올리지 않는다. 업로드는 App Store 정식 공개와 다르다. App Store 심사 제출·출시는 별도이며 이번 목적에 필요하지 않다.

EAS의 실제 `.ipa` 빌드 로그 및 App Store Connect 처리 결과를 확인한다. 위 export는 번들 검사일 뿐 Apple 서명/네이티브 컴파일/실기기 성공을 보증하지 않는다. ID 미설정 introspect에 Expo의 `com.placeholder.appid`가 나타날 수 있으며 이것으로 배포하지 않는다. production config는 실제 ID가 없으면 실패하도록 했다.

PC도 같은 변경을 배포한다:

```sh
cd /Users/kyoungpin/Desktop/01_coding/14hack1/posture-app
bun install --frozen-lockfile
bun run build
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib pairing::server::tests -- --nocapture
bun run tauri build
```

PC v0.1.3 Universal 패키지는 Developer ID 서명, Apple 공증, Gatekeeper 검사, Tauri updater 서명과 SHA-256 검사를 거쳐 GitHub 최신 릴리스로 배포했다. 개발 환경 없는 팀원에게는 Vite 서버가 아닌 이 빌드된 PC 앱을 전달한다.

## 팀원 초대 / 업데이트

- App Store Connect → Users and Access에서 필요한 앱 접근 권한을 가진 내부 사용자로 초대한다. 최소한의 적절한 역할을 계정 관리자가 선택한다.
- 앱 → TestFlight → Internal Testing에서 그룹을 만들고 처리 완료된 빌드와 사용자들을 추가한다. 내부 테스터는 App Store Connect 접근권한을 가진 사용자이며 최대 100명이다.
- 팀원은 App Store에서 TestFlight를 설치하고 초대 수락 → 앱 설치 → 홈 아이콘으로 실행한다. 개발 실행 QR은 없다. 연결 화면에서 **PC 페어링 QR**을 스캔한다.
- App Store Connect 접근 권한을 줄 수 없는 팀원은 External Testing을 이용한다. 내부 그룹과 달리 첫 외부 빌드는 Beta App Review가 필요할 수 있다. 앱스토어 정식 공개는 필요 없다.
- 이후 같은 Bundle ID/Expo 프로젝트로 production 재빌드 → submit → 그룹에 새 빌드 지정. buildNumber는 EAS가 증가시킨다. 사용자에게 보이는 버전 변경은 app.json의 version을 명시적으로 올린다.
- TestFlight 빌드 사용 기간은 **90일**이다. 계속 사용할 팀은 만료 전에 새 빌드를 배포한다. EAS Update를 쓰지 않으므로 JS 수정도 새 바이너리로 배포한다.

## LAN / 권한 / 재연결의 실제 범위

- 카메라는 앱 내부 QR 스캔 시 허용한다. iOS Local Network 권한은 최초 LAN 요청 시 허용한다. 거부했다면 iPhone 설정 → 앱 → 로컬 네트워크/카메라를 다시 허용하고 재시도한다. 첫 권한 대화상자 중 요청이 실패하면 허용 후 다시 연결한다.
- Bonjour 탐색을 하지 않으므로 NSBonjourServices/multicast 권한은 추가하지 않았다.
- ATS: NSAllowsArbitraryLoads=false, NSAllowsLocalNetworking=true. iOS 17+ IP 정책을 고려해 RFC1918 대역 10/8, 172.16/12, 192.168/16의 HTTP 예외만 추가했다. 임의 인터넷 도메인의 HTTP를 전역 허용하지 않는다. 실제 iOS 버전에서 HTTP와 ws 동작은 아래 표로 확인한다.
- 같은 SSID만으로 연결이 보장되지는 않는다. 게스트 Wi-Fi의 기기 격리, VPN, PC 방화벽, 잘못 선택된 NIC를 확인한다. PC QR에 127.0.0.1이 나오면 모바일이 연결할 수 없다. 기존 PC 주소 선택 방식은 기본 경로 기반 IPv4이며, 여러 NIC/VPN 환경은 실기기 확인 대상이다.
- 페어링 링크의 token은 연결 자격정보다. 실제 링크/QR을 이슈·공개 로그에 붙이지 않는다. HTTP/WS는 기존 신뢰된 LAN용 구조이며 TLS로 변경하지 않았다.
- 측정/등록/자세 상태는 snapshot에서 복원한다. 모바일은 연결 종료 후 지수 backoff로 재연결하고 heartbeat 무응답을 감지한다. 연결이 끊긴 동안 진동/소리는 중지된다.
- 보상 및 measurement_completed 결과 이벤트는 같은 eventId/sequence로 재전송한다. 모바일은 저장 성공 뒤 ACK하고 measurementId 기준 중복 저장을 막는다. 실시간 재전송은 5초 간격 최대 5회(최초 송신 포함), 미확인 결과는 메모리에 남아 다음 소켓 연결 때 재전송한다.
- PC가 계속 실행 중이면 모바일 종료 후 재실행/재페어링으로 미확인 결과를 받을 수 있다. Rust 전송 대기열은 메모리에 있지만 새 완료 결과는 PC 로컬 journal에도 남으며 PC 재실행 시 다시 전달된다. 이 수정 이전에 journal 없이 저장된 과거 PC 컬렉션의 일괄 이전은 포함하지 않는다. 모바일 재설치 시 저장 컬렉션도 사라진다.
- 기존 마지막 연결 복원을 유지한다. PC 재시작으로 token/port가 바뀌면 새 QR로 연결한다. 자동 복원 실패 시 재스캔한다.
- 현재 알림은 전경의 진동·소리·화면 반응이다. 푸시/시스템 알림/백그라운드 지속 실행은 구현하지 않았다. 화면 잠금·백그라운드에서 동일 동작을 보장하지 않는다. 소리 설정은 staysActiveInBackground=false다.
- 캐릭터는 PC의 기존 보상 조건을 충족해야 나온다. 무보상 종료에서 이벤트가 없는 것은 정상이다. 기존 7종 ID와 모바일 번들 이미지 매핑을 유지했다. 카탈로그를 새로 늘리거나 웹 카탈로그를 복제하지 않았다.

## 실기기 인수 테스트 — 전 항목 미검증

기록: iPhone 모델/iOS 버전, TestFlight 앱 version/buildNumber, PC OS/빌드 커밋, LAN 종류, 날짜, 결과. 실제 페어링 token은 기록하지 않는다.

| 순서 | 절차 | 합격 기준 | 결과 |
| --- | --- | --- | --- |
| 1 | PC/개발 PC의 Expo Metro를 모두 종료. TestFlight 설치 후 홈 아이콘 실행 | Expo Go/개발 서버 연결 화면 없이 연결 화면 표시 | 미검증 |
| 2 | 업데이트된 PC 앱 실행. 앱 내부 QR 스캔. 카메라/LAN 허용 | /pair 성공, WS snapshot 및 연결 표시 | 미검증 |
| 3 | 모바일 강제 종료 후 iPhone 기본 카메라 등으로 현재 PC QR의 vibeapp 링크 열기 | 앱 실행 후 해당 PC 연결 | 미검증 |
| 4 | 모바일 열린 상태에서 동일 링크 및 다른 PC의 유효 링크 열기 | 기존 소켓 정리 후 선택한 PC 연결. 두 PC 이벤트 혼합 없음 | 미검증 |
| 5 | PC 좋은 자세 등록 → 측정 시작 | 모바일 등록/측정 상태 일치 | 미검증 |
| 6 | 측정 중 나쁜 자세 → 좋은 자세 | 전경 화면·진동·소리 시작/정지, iPhone 햅틱 설정도 확인 | 미검증 |
| 7 | 실제 보상 조건 충족 후 측정 종료 | 측정 상태 종료, 캐릭터 결과 표시·저장, 재전송으로 카드 중복 안 됨 | 미검증 |
| 8 | 모바일 종료/재실행 | 획득 카드 유지, PC가 켜져 있으면 기존 복원 또는 QR 재연결 가능 | 미검증 |
| 9 | 측정 중 Wi-Fi 일시 해제 후 복구 | 재연결 후 snapshot의 현재 자세/측정 상태 반영, 알림 정상 복귀 | 미검증 |
| 10 | 모바일 단절 중 PC에서 보상 획득, 30초 이후 재연결(PC는 종료하지 않음) | 미확인 결과 재전송·저장·ACK, 중복 카드 없음 | 미검증 |
| 11 | 모바일 잠금/백그라운드 → 전경 복귀 | 백그라운드 알림은 미지원으로 기록, 전경 복귀 후 동기화 확인 | 미검증 |
| 12 | 권한 거부→설정 허용, 잘못된 QR, PC 종료/재시작, 게스트 Wi-Fi | 실패 안내·재스캔 가능, 무한 로딩 없음, 새 PC QR로 복구 | 미검증 |

## 실행한 자동 검증

- 모바일 lint / TypeScript: 통과.
- 모바일 회귀 테스트: cold/warm 링크 변환·잘못된 포트, 저장 전 ACK 금지·저장 실패 시 ACK 금지·중복 저장 방지 통과. OS 자체 링크 전달/카메라/AsyncStorage 네이티브 디스크는 이 테스트의 대상이 아니다.
- iOS production JS/Hermes 번들 및 60개 asset export: 성공. 서명된 IPA 아님.
- Expo native config introspect: vibeapp scheme, 카메라/로컬 네트워크 설명, ATS 제한 확인.
- PC `bun run build`, Rust `cargo check`: 통과.
- `npm run test:contracts`: 두 저장소의 카탈로그 공유 필드, 정렬 순서, 별칭, 7개 portrait의 SHA-256 일치. PC checkout은 기본 ../posture-app이며 POSTURE_APP_DIR로 지정 가능. 웹의 별도 17종 카탈로그는 모바일에 복사하지 않음.
- 로컬 네이티브 iOS 빌드: 전체 Xcode 없이 Command Line Tools만 활성화되어 실행 불가. EAS 클라우드 빌드에 로컬 Xcode는 필요하지 않음.
- 실제 loopback TCP HTTP/WS 통합 테스트: 잘못된 token 거부, pair, snapshot, 측정/자세, 재연결, 보상, 재전송, 잘못된 ACK, TCP로 분할/합쳐진 ACK+ping, ACK 후 대기열 제거, disconnect 통과. sandbox 포트 차단 때문에 허용된 샌드박스 밖에서 실행했다.
- 위 loopback 테스트는 실제 Tauri 카메라 측정→보상 UI 및 iPhone LAN E2E를 대신하지 않는다.
- EAS 계정 연결·Apple 서명·IPA 업로드·TestFlight 내부 그룹 배정·테스터 초대: 완료. 실제 iPhone 설치와 전체 연동 검증은 미실행.

## 공식 근거

- [Expo TestFlight](https://docs.expo.dev/submit/testflight/), [EAS build profile](https://docs.expo.dev/build/eas-json/), [iOS submit](https://docs.expo.dev/submit/ios/)
- [Expo native intent](https://docs.expo.dev/router/advanced/native-intent/), [EAS app versions](https://docs.expo.dev/build-reference/app-versions/)
- [Apple 로컬 ATS](https://developer.apple.com/documentation/bundleresources/information-property-list/nsapptransportsecurity/nsallowslocalnetworking)
- [Apple 내부 테스터 및 90일](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers), [외부 테스트](https://developer.apple.com/testflight/)

잠금 중 PC 종료의 현재 처리·문제·수정·자동/실기기 검증은 [상세 보고](locked-completion.md)에 기록했다. 결과 sourceId는 PC 로컬 데이터 출처이며 Apple/Expo 계정 ID가 아니다.

## 배포 자격증명과 다음 업데이트

2026-09-19 사용자 승인으로 EAS Submit용 App Store Connect API 키를 생성했다. 역할은 CLI가 제공한 최소 앱 관리 권한 `APP_MANAGER`를 선택했다. 키 이름은 `[Expo] EAS Submit Yj0HIiF8yQ`, Key ID는 `S99S9Q3U9G`다. 이 식별자는 비밀키가 아니다. 키 원문은 EAS 서버에서 관리하며 코드나 이 문서에 저장하지 않는다. EAS가 `com.kyoungpin.piiin`에 키를 연결한 것을 확인했다.

- 매 업데이트마다 키를 새로 만들거나 외울 필요 없다. 같은 Expo 계정/프로젝트와 Apple 앱을 유지한다.
- 자격증명 연결 확인/변경: 모바일 작업 폴더에서 `npx --yes eas-cli@latest credentials --platform ios`. 비밀키를 출력하거나 문서에 복사하지 않는다.
- Apple에서 키를 폐기하거나 권한이 변경되면 업로드 인증을 다시 설정한다. Distribution 인증서 및 프로비저닝 프로파일의 갱신은 API 키와 별개다. 기존 인증서를 무조건 폐기하지 않는다.
- 다른 PC에서는 Expo 로그인과 저장소 체크아웃이 필요하다. 로컬 Apple 로그인 세션은 자동 공유되지 않으며 필요할 때 계정 소유자가 다시 인증한다.

```sh
cd /Users/kyoungpin/Desktop/01_coding/14hack1/vibe-app
# 이 Mac 터미널에서 npx를 찾지 못할 때만 사용
export PATH="/Users/kyoungpin/.nvm/versions/node/v20.19.0/bin:$PATH"
npx --yes eas-cli@latest build --platform ios --profile production
# 빌드 완료 후 목록에서 방금 만든 버전과 ID 확인
npx --yes eas-cli@latest build:list --platform ios --limit 3
npx --yes eas-cli@latest submit --platform ios --profile production --id <방금_완료된_BUILD_ID>
```

`<방금_완료된_BUILD_ID>`는 실제 빌드 UUID로 교체한다. 이후 App Store Connect의 TestFlight에서 처리 완료 여부 및 테스트 그룹의 빌드 배정을 확인한다. 빌드 번호는 자동 증가하며 사용자 표시 버전은 필요할 때 app.json에서 변경한다.

첫 업로드 추적: [EAS Submit](https://expo.dev/accounts/kyoung9/projects/vibe-app/submissions/86824483-3b41-40df-8480-45a1021bab45). 업로드 완료와 Apple 처리 완료, 실제 기기 설치 검증은 각각 구분한다.

## 데스크톱 아이콘 적용 — 1.0.0 (3)

모바일 `assets/images/icon.png`를 posture-app의 기존 `src-tauri/icons/ios/AppIcon-512@2x.png`로 교체했다. 새 그림을 만들지 않고 같은 데스크톱 아이콘의 기존 iOS 자산(1024×1024)을 재사용했다. SHA-256 `4ad01519b94b3e20ed6f9dc1221d0f45f3357eff8e82f8a60442dc1927e1be2e` 일치 확인. SDK 54의 iOS 아이콘 생성기는 기본 아이콘의 투명도를 제거한다. Android adaptive icon 및 시작 화면은 이번 iPhone 홈 아이콘 변경 범위에 포함하지 않는다.

- lint, TypeScript 검사 통과. 실제 iPhone 홈 화면의 마스킹/표시는 설치 후 확인해야 한다.
- [아이콘 변경 빌드 1.0.0 (3)](https://expo.dev/accounts/kyoung9/projects/vibe-app/builds/cca429be-d4db-4eb4-b9be-eb6271f60acc): FINISHED 확인.
- [후속 제출](https://expo.dev/accounts/kyoung9/projects/vibe-app/submissions/b94c0bdc-4236-4ea4-bd43-e68f5d76b7de): App Store Connect에서 1.0.0 (3)의 업로드 종료 및 테스트 빌드 목록 표시를 확인했다.
- 기존 EAS 인증서/API 키 재사용 확인. EAS Submit이 `Team (Expo)` TestFlight 그룹을 생성했다. 테스터 추가 및 실제 설치는 아직 확인하지 않았다.
- App Store Connect의 내부 `Team (Expo)` 그룹에 `nanmi987@icloud.com` 계정을 추가했다. 2026-09-19 기준 상태는 `초대됨`, 그룹은 테스터 1명·빌드 2개다. iPhone에서 초대 수락, 빌드 3 설치 및 실행은 아직 실기기 확인 전이다.
- 연동 수정이 포함된 posture-app은 [v0.1.3](https://github.com/vyuma/posture-app/releases/tag/v0.1.3)으로 배포했다. Universal DMG와 자동 업데이트 파일 모두 Developer ID 서명·Apple 공증·공개 다운로드 검증을 완료했다.

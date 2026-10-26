// ===== 収益化の設定（アフィリエイトリンク） =====
// 見積もりの下に出る「このプランを手配する」ボタンの設定です。
//
// url の中の {変数} は、選んだ条件で自動的に置き換わります。
//   {fromSky} {toSky}  Skyscannerの出発地・目的地コード
//   {city}             都市名（日本語）   {cityEn} 都市名（英語）
//   {depYmd} {retYmd}  出発日・帰国日（YYMMDD形式、Skyscanner用）
//   {checkin} {checkout} 宿のチェックイン・チェックアウト日（YYYY-MM-DD）
//   {people}           人数
//
// ASPでアフィリエイトリンクを発行したら：
//   1. 広告主のサイトに直接飛ぶ専用URLをもらえる場合 → url をそのURLに書き換える
//   2. 「遷移先URLを指定できる」リンク（もしもアフィリエイトなど）の場合
//      → wrap に発行されたリンクを貼り、遷移先URLの部分を {url} に置き換える
//      例：wrap: "https://af.moshimo.com/af/c/click?a_id=000&p_id=000&pc_id=000&pl_id=000&url={url}"
//   3. affiliate を true にする（ボタンと見出しに「PR」表記が付きます）
//
// url を空 "" にしたボタンは表示されません。
window.TRIP_AFFILIATES = [
  {
    id: "flight", label: "航空券の料金を見る", partner: "Skyscanner", primary: true,
    affiliate: false, wrap: "",
    url: "https://www.skyscanner.jp/transport/flights/{fromSky}/{toSky}/{depYmd}/{retYmd}/?adultsv2={people}&cabinclass=economy&rtn=1"
  },
  {
    id: "hotel", label: "宿を探す", partner: "Booking.com",
    affiliate: false, wrap: "",
    url: "https://www.booking.com/searchresults.ja.html?ss={cityEn}&checkin={checkin}&checkout={checkout}&group_adults={people}"
  },
  {
    id: "tour", label: "現地ツアー・チケットを探す", partner: "",
    affiliate: false, wrap: "",
    url: ""
  },
  {
    id: "esim", label: "海外eSIMを選ぶ", partner: "",
    affiliate: false, wrap: "",
    url: ""
  },
  {
    id: "insurance", label: "海外旅行保険を比べる", partner: "",
    affiliate: false, wrap: "",
    url: ""
  }
];

import Image from "next/image";

export default function Home() {
  return (
    <main className="portal-page expired-page">
      <section className="expired-card">
        <Image className="home-logo" src="/brand/xiaoyuan-pte-round.png" alt="小圆 PTE 突击" width={78} height={78} priority />
        <span className="eyebrow">小圆 PTE 突击</span>
        <h1>你的宝藏资料在专属链接里</h1>
        <p>请从小红书订单的自动发货信息打开对应资料链接。</p>
      </section>
    </main>
  );
}

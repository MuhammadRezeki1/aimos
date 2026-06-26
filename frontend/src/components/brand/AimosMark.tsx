import Image from "next/image";

export function AimosMark() {
  return (
    <Image
      className="brand-mark"
      src="/brand/aimos-mark.svg"
      alt="AIMOS mark"
      width={56}
      height={56}
      priority
    />
  );
}

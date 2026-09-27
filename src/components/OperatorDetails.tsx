import { OPERATOR } from "@/lib/site";

export function OperatorDetails() {
  return (
    <address className="not-italic leading-relaxed">
      {OPERATOR.name}
      <br />
      IČO: {OPERATOR.ico}
      <br />
      Sídlo: {OPERATOR.address}
      <br />
      E-mail:{" "}
      <a className="text-primary hover:underline" href={`mailto:${OPERATOR.email}`}>
        {OPERATOR.email}
      </a>
      <br />
      <a
        className="text-primary hover:underline"
        href={OPERATOR.registerUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Údaje provozovatele v ARES
      </a>
    </address>
  );
}

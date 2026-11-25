import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props { companyName?: string; eventName?: string; booth?: string; trackingUrl?: string }
function Email({ companyName, eventName, booth, trackingUrl }: Props) {
  return <Html lang="en"><Head /><Preview>{`Your freight tracking for ${eventName ?? "your event"}`}</Preview>
    <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" }}>
      <Container style={{ maxWidth: "560px", padding: "28px 24px" }}>
        <Text style={{ color: "#0f9488", fontWeight: 700 }}>ExpoHaul</Text>
        <Heading style={{ color: "#0b1f3a", fontSize: "24px" }}>Your freight at {eventName}</Heading>
        <Text>{companyName} · Booth {booth ?? "—"}</Text>
        <Text>Follow your registered pieces, venue arrivals, booth deliveries, service charges and invoices. Sign in using the email address that received this invitation.</Text>
        {trackingUrl && <Button href={trackingUrl} style={{ backgroundColor: "#0f9488", color: "#ffffff", padding: "14px 22px", borderRadius: "6px", textDecoration: "none" }}>View my freight</Button>}
      </Container>
    </Body>
  </Html>;
}
export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Your freight tracking — ${d["eventName"] ?? "ExpoHaul"}`,
  displayName: "Exhibitor freight tracking invitation",
  previewData: { companyName: "Acme Marine", eventName: "Marine Expo", booth: "101" },
} satisfies TemplateEntry;
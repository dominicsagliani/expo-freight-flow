import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  contractorName?: string
  contactName?: string
  exhibitorName?: string
  eventName?: string
  booth?: string
  ticketNumber?: string
  service?: string
  completedAt?: string
  amount?: string
  paymentUrl?: string
  instructions?: string
}

const Email = ({ contractorName = 'Your service company', contactName, exhibitorName, eventName, booth, ticketNumber, service, completedAt, amount = '—', paymentUrl, instructions }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${amount} due for ${service ?? 'forklift service'}${booth ? ` at booth ${booth}` : ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>{contractorName}</Text>
        <Heading style={h1}>Service complete — {amount} due</Heading>
        <Text style={text}>{contactName ? `Hi ${contactName},` : 'Hello,'} your material handling job is done. You can pay now instead of waiting for an invoice after the show.</Text>
        <Section style={box}>
          {[
            ['Job', ticketNumber], ['Service', service], ['Company', exhibitorName], ['Show', eventName], ['Booth', booth], ['Completed', completedAt],
          ].filter(([, v]) => v).map(([k, v]) => (
            <Text key={k} style={row}><span style={label}>{k}</span>&nbsp;&nbsp;{v}</Text>
          ))}
          <Hr style={hr} />
          <Text style={total}>Amount due: {amount}</Text>
        </Section>
        {paymentUrl ? <Button href={paymentUrl} style={button}>Pay {amount} now</Button> : null}
        {instructions ? <Text style={text}>{instructions}</Text> : null}
        <Text style={small}>Please include job {ticketNumber ?? ''} with your payment. Questions? Just reply to this email.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${d.amount ?? 'Payment'} due — ${d.ticketNumber ?? 'forklift service'} complete`,
  displayName: 'Service receipt with pay button',
  previewData: { contractorName: 'Summit Material Handling', contactName: 'Jane', exhibitorName: 'Northwind Robotics', eventName: 'Pacific Manufacturing Expo', booth: '1214', ticketNumber: 'MH-10002', service: 'Inbound delivery to booth', completedAt: 'Nov 13, 2:40 PM', amount: '$197.00', paymentUrl: 'https://example.com/pay', instructions: 'Card, ACH or check accepted.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const eyebrow = { color: '#0f9488', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: 0 }
const h1 = { color: '#0b1f3a', fontSize: '24px', margin: '8px 0 12px' }
const text = { color: '#33415c', fontSize: '15px', lineHeight: '22px' }
const box = { border: '1px solid #dbe2ea', borderRadius: '8px', padding: '12px 16px', margin: '16px 0' }
const row = { color: '#0b1f3a', fontSize: '14px', margin: '4px 0' }
const label = { color: '#6b7a90', display: 'inline-block', width: '90px' }
const hr = { borderColor: '#dbe2ea', margin: '10px 0' }
const total = { color: '#0b1f3a', fontSize: '18px', fontWeight: 700, margin: 0 }
const button = { backgroundColor: '#0f9488', color: '#ffffff', borderRadius: '6px', padding: '14px 22px', fontWeight: 700, fontSize: '16px', textDecoration: 'none' }
const small = { color: '#6b7a90', fontSize: '12px', marginTop: '20px' }

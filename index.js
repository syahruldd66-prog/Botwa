```javascript
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')

const P = require('pino')
const qrcode = require('qrcode-terminal')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session')

  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    auth: state
  })

  // QR CODE
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {

    if (qr) {
      qrcode.generate(qr, { small: true })
      console.log('Scan QR di WhatsApp')
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) {
        startBot()
      }
    }

    if (connection === 'open') {
      console.log('✅ Bot WhatsApp berhasil terkoneksi')
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // MESSAGE
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0]

      if (!msg.message) return

      const from = msg.key.remoteJid

      const isGroup = from.endsWith('@g.us')

      if (!isGroup) return

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''

      const sender = msg.key.participant

      const groupData = await sock.groupMetadata(from)

      const admins = groupData.participants
        .filter(v => v.admin)
        .map(v => v.id)

      const isAdmin = admins.includes(sender)

      // HANYA ADMIN
      if (!isAdmin) {
        return sock.sendMessage(from, {
          text: '❌ Command hanya untuk admin grup!'
        })
      }

      // MENU
      if (body === '.menu') {
        return sock.sendMessage(from, {
          text: `
╔═══ BOT ADMIN ═══╗

.menu
.tagall
.hidetag
.kick
.promote
.demote

╚════════════════╝
          `
        })
      }

      // TAG ALL
      if (body === '.tagall') {

        let teks = '📢 TAG ALL\n\n'

        let mentions = []

        for (let member of groupData.participants) {
          teks += `@${member.id.split('@')[0]}\n`
          mentions.push(member.id)
        }

        return sock.sendMessage(from, {
          text: teks,
          mentions
        })
      }

      // HIDETAG
      if (body.startsWith('.hidetag')) {

        const text = body.replace('.hidetag', '').trim()

        let mentions = groupData.participants.map(v => v.id)

        return sock.sendMessage(from, {
          text: text || 'Pesan admin',
          mentions
        })
      }

      // KICK
      if (body.startsWith('.kick')) {

        const mentioned =
          msg.message.extendedTextMessage?.contextInfo?.mentionedJid

        if (!mentioned) {
          return sock.sendMessage(from, {
            text: 'Tag member yang ingin dikick'
          })
        }

        await sock.groupParticipantsUpdate(
          from,
          mentioned,
          'remove'
        )

        return sock.sendMessage(from, {
          text: '✅ Member berhasil dikick'
        })
      }

      // PROMOTE
      if (body.startsWith('.promote')) {

        const mentioned =
          msg.message.extendedTextMessage?.contextInfo?.mentionedJid

        if (!mentioned) {
          return sock.sendMessage(from, {
            text: 'Tag member yang ingin dijadikan admin'
          })
        }

        await sock.groupParticipantsUpdate(
          from,
          mentioned,
          'promote'
        )

        return sock.sendMessage(from, {
          text: '✅ Member berhasil dijadikan admin'
        })
      }

      // DEMOTE
      if (body.startsWith('.demote')) {

        const mentioned =
          msg.message.extendedTextMessage?.contextInfo?.mentionedJid

        if (!mentioned) {
          return sock.sendMessage(from, {
            text: 'Tag admin yang ingin diturunkan'
          })
        }

        await sock.groupParticipantsUpdate(
          from,
         mentioned,
          'demote'
        )

        return sock.sendMessage(from, {
          text: '✅ Admin berhasil diturunkan'
        })
      }

    } catch (err) {
      console.log(err)
    }
  })
}

startBot()
```

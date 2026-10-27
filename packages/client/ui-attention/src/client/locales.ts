/** `attention` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'toast.interaction.approval': '{title} 正在等待审批',
  'toast.interaction.planReview': '{title} 正在等待计划确认',
  'toast.interaction.question': '{title} 正在等待你的回答',
  'toast.completion': '{title} 已完成',
  'settings.title': '提醒',
  'settings.description': '会话需要你确认，或后台会话完成时提醒你',
  'settings.interaction': '交互提醒',
  'settings.interactionDescription': '会话等待审批、计划确认或回答时提醒',
  'settings.completion': '完成提醒',
  'settings.completionDescription': '后台会话完成一轮工作时提醒',
  'settings.sound': '提示音',
  'settings.soundDescription': '提醒时播放提示音',
  'settings.badge': '图标计数',
  'settings.badgeDescription': '在页面图标上显示待处理提醒数',
  'settings.error': '无法保存设置',
} satisfies Record<string, string>

/** The attention namespace key union. */
export type AttentionKey = keyof typeof zh

/** English dictionary. */
export const en = {
  'toast.interaction.approval': '{title} is waiting for approval',
  'toast.interaction.planReview': '{title} is waiting for plan review',
  'toast.interaction.question': '{title} is waiting for your answer',
  'toast.completion': '{title} finished',
  'settings.title': 'Reminders',
  'settings.description': 'Notify you when a Session needs confirmation or a background Session finishes',
  'settings.interaction': 'Interaction reminders',
  'settings.interactionDescription': 'Remind when a Session waits for approval, plan review, or an answer',
  'settings.completion': 'Completion reminders',
  'settings.completionDescription': 'Remind when a background Session finishes a Turn',
  'settings.sound': 'Chime',
  'settings.soundDescription': 'Play a chime with each reminder',
  'settings.badge': 'Icon count',
  'settings.badgeDescription': 'Show pending reminders on the page icon',
  'settings.error': 'Could not save the setting',
} satisfies Record<AttentionKey, string>

/** Japanese dictionary. */
export const ja = {
  'toast.interaction.approval': '{title} が承認待ちです',
  'toast.interaction.planReview': '{title} が計画の確認待ちです',
  'toast.interaction.question': '{title} が回答待ちです',
  'toast.completion': '{title} が完了しました',
  'settings.title': 'リマインダー',
  'settings.description': 'セッションの確認待ちやバックグラウンドのセッション完了時に通知します',
  'settings.interaction': 'インタラクションの通知',
  'settings.interactionDescription': 'セッションが承認・計画確認・回答を待つときに通知します',
  'settings.completion': '完了の通知',
  'settings.completionDescription': 'バックグラウンドのセッションが1ターン完了したときに通知します',
  'settings.sound': '通知音',
  'settings.soundDescription': '通知時に通知音を再生します',
  'settings.badge': 'アイコンカウント',
  'settings.badgeDescription': '未確認のリマインダー数をページアイコンに表示します',
  'settings.error': '設定を保存できませんでした',
} satisfies Record<AttentionKey, string>

/** Spanish dictionary. */
export const es = {
  'toast.interaction.approval': '{title} está esperando aprobación',
  'toast.interaction.planReview': '{title} está esperando la revisión del plan',
  'toast.interaction.question': '{title} está esperando tu respuesta',
  'toast.completion': '{title} ha terminado',
  'settings.title': 'Recordatorios',
  'settings.description': 'Avísame cuando una sesión necesite confirmación o una sesión en segundo plano termine',
  'settings.interaction': 'Recordatorios de interacción',
  'settings.interactionDescription': 'Avisar cuando una sesión espere aprobación, revisión del plan o una respuesta',
  'settings.completion': 'Recordatorios de finalización',
  'settings.completionDescription': 'Avisar cuando una sesión en segundo plano termine un turno',
  'settings.sound': 'Tono',
  'settings.soundDescription': 'Reproducir un tono con cada recordatorio',
  'settings.badge': 'Recuento en el icono',
  'settings.badgeDescription': 'Mostrar los recordatorios pendientes en el icono de la página',
  'settings.error': 'No se pudo guardar la configuración',
} satisfies Record<AttentionKey, string>

/** French dictionary. */
export const fr = {
  'toast.interaction.approval': '{title} attend une approbation',
  'toast.interaction.planReview': '{title} attend la révision du plan',
  'toast.interaction.question': '{title} attend votre réponse',
  'toast.completion': '{title} est terminé',
  'settings.title': 'Rappels',
  'settings.description': 'Vous avertir lorsqu’une session attend une confirmation ou qu’une session en arrière-plan se termine',
  'settings.interaction': 'Rappels d’interaction',
  'settings.interactionDescription': 'Rappeler lorsqu’une session attend une approbation, une révision du plan ou une réponse',
  'settings.completion': 'Rappels de fin',
  'settings.completionDescription': 'Rappeler lorsqu’une session en arrière-plan termine un tour',
  'settings.sound': 'Carillon',
  'settings.soundDescription': 'Jouer un carillon à chaque rappel',
  'settings.badge': 'Compteur d’icône',
  'settings.badgeDescription': 'Afficher les rappels en attente sur l’icône de la page',
  'settings.error': 'Impossible d’enregistrer le paramètre',
} satisfies Record<AttentionKey, string>

/** German dictionary. */
export const de = {
  'toast.interaction.approval': '{title} wartet auf Freigabe',
  'toast.interaction.planReview': '{title} wartet auf Planprüfung',
  'toast.interaction.question': '{title} wartet auf deine Antwort',
  'toast.completion': '{title} ist fertig',
  'settings.title': 'Erinnerungen',
  'settings.description': 'Benachrichtigt dich, wenn eine Sitzung eine Bestätigung braucht oder eine Sitzung im Hintergrund endet',
  'settings.interaction': 'Interaktionserinnerungen',
  'settings.interactionDescription': 'Erinnern, wenn eine Sitzung auf Freigabe, Planprüfung oder eine Antwort wartet',
  'settings.completion': 'Abschlusserinnerungen',
  'settings.completionDescription': 'Erinnern, wenn eine Sitzung im Hintergrund einen Turn beendet',
  'settings.sound': 'Ton',
  'settings.soundDescription': 'Bei jeder Erinnerung einen Ton abspielen',
  'settings.badge': 'Symbolzähler',
  'settings.badgeDescription': 'Ausstehende Erinnerungen am Seitensymbol anzeigen',
  'settings.error': 'Einstellung konnte nicht gespeichert werden',
} satisfies Record<AttentionKey, string>

/** Russian dictionary. */
export const ru = {
  'toast.interaction.approval': '{title} ожидает подтверждения',
  'toast.interaction.planReview': '{title} ожидает проверки плана',
  'toast.interaction.question': '{title} ожидает вашего ответа',
  'toast.completion': '{title} завершён',
  'settings.title': 'Напоминания',
  'settings.description': 'Сообщать, когда сеансу нужно подтверждение или фоновый сеанс завершён',
  'settings.interaction': 'Напоминания о взаимодействии',
  'settings.interactionDescription': 'Напоминать, когда сеанс ждёт подтверждения, проверки плана или ответа',
  'settings.completion': 'Напоминания о завершении',
  'settings.completionDescription': 'Напоминать, когда фоновый сеанс завершает ход',
  'settings.sound': 'Звук',
  'settings.soundDescription': 'Проигрывать звук при каждом напоминании',
  'settings.badge': 'Счётчик на значке',
  'settings.badgeDescription': 'Показывать ожидающие напоминания на значке страницы',
  'settings.error': 'Не удалось сохранить настройку',
} satisfies Record<AttentionKey, string>

/** Portuguese dictionary. */
export const pt = {
  'toast.interaction.approval': '{title} está aguardando aprovação',
  'toast.interaction.planReview': '{title} está aguardando a revisão do plano',
  'toast.interaction.question': '{title} está aguardando sua resposta',
  'toast.completion': '{title} foi concluída',
  'settings.title': 'Lembretes',
  'settings.description': 'Avise quando uma sessão precisar de confirmação ou uma sessão em segundo plano terminar',
  'settings.interaction': 'Lembretes de interação',
  'settings.interactionDescription': 'Avisar quando uma sessão aguardar aprovação, revisão do plano ou resposta',
  'settings.completion': 'Lembretes de conclusão',
  'settings.completionDescription': 'Avisar quando uma sessão em segundo plano concluir um turno',
  'settings.sound': 'Tom',
  'settings.soundDescription': 'Reproduzir um tom a cada lembrete',
  'settings.badge': 'Contagem no ícone',
  'settings.badgeDescription': 'Mostrar lembretes pendentes no ícone da página',
  'settings.error': 'Não foi possível salvar a configuração',
} satisfies Record<AttentionKey, string>

/** Copy keys the reminder banner reads. */
export type AttentionToastKey = Extract<AttentionKey, `toast.${string}`>

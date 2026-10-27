/** `quickScript` namespace dictionaries: the composer play menu's copy. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'quickScript'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.open': '快捷脚本',
  'menu.empty': '暂无快捷脚本',
  'menu.add': '添加脚本',
  'menu.delete': '删除脚本',
  'form.name': '脚本名称',
  'form.path': '脚本绝对路径',
  'form.save': '保存',
  'form.cancel': '取消',
  'form.invalid': '请填写脚本名称和绝对路径',
  'run.failed': '无法打开终端',
} satisfies Record<string, string>

/** The quick-script namespace key union. */
export type QuickScriptKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'action.open': 'Quick scripts',
  'menu.empty': 'No quick scripts',
  'menu.add': 'Add script',
  'menu.delete': 'Delete script',
  'form.name': 'Script name',
  'form.path': 'Absolute script path',
  'form.save': 'Save',
  'form.cancel': 'Cancel',
  'form.invalid': 'Enter a script name and an absolute path',
  'run.failed': 'Could not open a terminal',
} satisfies Record<QuickScriptKey, string>

/** Japanese copy, checked against the Chinese keys. */
export const ja = {
  'action.open': 'クイックスクリプト',
  'menu.empty': 'クイックスクリプトはありません',
  'menu.add': 'スクリプトを追加',
  'menu.delete': 'スクリプトを削除',
  'form.name': 'スクリプト名',
  'form.path': 'スクリプトの絶対パス',
  'form.save': '保存',
  'form.cancel': 'キャンセル',
  'form.invalid': 'スクリプト名と絶対パスを入力してください',
  'run.failed': 'ターミナルを開けませんでした',
} satisfies Record<QuickScriptKey, string>

/** Spanish copy, checked against the Chinese keys. */
export const es = {
  'action.open': 'Scripts rápidos',
  'menu.empty': 'No hay scripts rápidos',
  'menu.add': 'Añadir script',
  'menu.delete': 'Eliminar script',
  'form.name': 'Nombre del script',
  'form.path': 'Ruta absoluta del script',
  'form.save': 'Guardar',
  'form.cancel': 'Cancelar',
  'form.invalid': 'Escribe un nombre y una ruta absoluta',
  'run.failed': 'No se pudo abrir una terminal',
} satisfies Record<QuickScriptKey, string>

/** French copy, checked against the Chinese keys. */
export const fr = {
  'action.open': 'Scripts rapides',
  'menu.empty': 'Aucun script rapide',
  'menu.add': 'Ajouter un script',
  'menu.delete': 'Supprimer le script',
  'form.name': 'Nom du script',
  'form.path': 'Chemin absolu du script',
  'form.save': 'Enregistrer',
  'form.cancel': 'Annuler',
  'form.invalid': 'Saisissez un nom et un chemin absolu',
  'run.failed': 'Impossible d’ouvrir un terminal',
} satisfies Record<QuickScriptKey, string>

/** German copy, checked against the Chinese keys. */
export const de = {
  'action.open': 'Schnellskripte',
  'menu.empty': 'Keine Schnellskripte',
  'menu.add': 'Skript hinzufügen',
  'menu.delete': 'Skript löschen',
  'form.name': 'Skriptname',
  'form.path': 'Absoluter Skriptpfad',
  'form.save': 'Speichern',
  'form.cancel': 'Abbrechen',
  'form.invalid': 'Skriptname und absoluten Pfad eingeben',
  'run.failed': 'Terminal konnte nicht geöffnet werden',
} satisfies Record<QuickScriptKey, string>

/** Russian copy, checked against the Chinese keys. */
export const ru = {
  'action.open': 'Быстрые скрипты',
  'menu.empty': 'Быстрых скриптов нет',
  'menu.add': 'Добавить скрипт',
  'menu.delete': 'Удалить скрипт',
  'form.name': 'Имя скрипта',
  'form.path': 'Абсолютный путь к скрипту',
  'form.save': 'Сохранить',
  'form.cancel': 'Отмена',
  'form.invalid': 'Укажите имя скрипта и абсолютный путь',
  'run.failed': 'Не удалось открыть терминал',
} satisfies Record<QuickScriptKey, string>

/** Portuguese copy, checked against the Chinese keys. */
export const pt = {
  'action.open': 'Scripts rápidos',
  'menu.empty': 'Nenhum script rápido',
  'menu.add': 'Adicionar script',
  'menu.delete': 'Excluir script',
  'form.name': 'Nome do script',
  'form.path': 'Caminho absoluto do script',
  'form.save': 'Salvar',
  'form.cancel': 'Cancelar',
  'form.invalid': 'Informe um nome e um caminho absoluto',
  'run.failed': 'Não foi possível abrir um terminal',
} satisfies Record<QuickScriptKey, string>

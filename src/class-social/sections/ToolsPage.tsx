// "Tất cả công cụ" — đủ danh sách công cụ âm nhạc THẬT cho học sinh, theo nhóm nhu cầu.
// Mỗi thẻ là link cùng tab tới route của công cụ (Back quay lại đây); quyền vào do app quyết định.
import { TOOLS, TOOL_GROUP_LABEL, type ToolGroup } from '../tools'

const ORDER: ToolGroup[] = ['nhip', 'cao-do', 'ban-nhac', 'sang-tao']

export default function ToolsPage() {
  return (
    <div className="cs-col">
      <h1 className="cs-page-title">Công cụ âm nhạc</h1>
      {ORDER.map(g => {
        const items = TOOLS.filter(t => t.group === g)
        if (items.length === 0) return null
        return (
          <section key={g} className="cs-tools-group" aria-labelledby={`cs-tools-${g}`}>
            <h2 id={`cs-tools-${g}`} className="cs-tools-title">{TOOL_GROUP_LABEL[g]}</h2>
            <ul className="cs-tools-grid">
              {items.map(t => (
                <li key={t.id}>
                  <a className="cs-card cs-tool" href={t.href}>
                    <span className="cs-tool-icon" aria-hidden="true"><t.icon size={22} strokeWidth={1.9} /></span>
                    <span className="cs-tool-text">
                      <span className="cs-tool-name">{t.label}</span>
                      <span className="cs-tool-hint">{t.hint}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

import { ChevronLeft } from "lucide-react"
// Phone frame: devices.css (MIT, devicescss.xyz), imported in index.css. Fixed 428 × 868 px, so it's scaled with CSS zoom.
import { cn } from "@/lib/utils"

export type Msg = { text: string; me?: boolean }

/** A phone showing Draki's texts as a chat. Plain SMS: it works on any phone, no app. */
export function Phone({ msgs, stamp, empty = "No texts yet.", className }: { msgs: Msg[]; stamp?: string; empty?: string; className?: string }) {
  return (
    <div className={cn("flex justify-center", className)}>
      <div className="device device-iphone-14-pro [zoom:0.6] sm:[zoom:0.72]">
        <div className="device-frame">
          <div className="device-screen flex flex-col overflow-hidden bg-card text-ink">
            <div className="flex items-center justify-between px-10 pt-5 text-[1.05rem] font-semibold tabular-nums" aria-hidden>
              <span>6:02</span>
              <span>4G</span>
            </div>
            <div className="relative mt-6 flex flex-col items-center gap-1 border-b border-rule pb-3">
              <ChevronLeft className="absolute top-3 left-5 size-7 text-rain" aria-hidden />
              <span className="grid size-14 place-items-center rounded-full bg-leaf text-xl font-semibold text-white" aria-hidden>
                D
              </span>
              <span className="text-sm">Draki</span>
            </div>
            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-5 text-[1.2rem] leading-snug" aria-label="Text messages from Draki">
              {stamp && <p className="mb-1 text-center text-sm text-muted-foreground">Text message · {stamp}</p>}
              {msgs.length === 0 && <p className="m-auto text-muted-foreground">{empty}</p>}
              {msgs.map((m, i) => (
                <p
                  key={i}
                  className={cn("max-w-[82%] rounded-[1.4rem] px-4 py-2.5 whitespace-pre-line", m.me ? "self-end rounded-br-md bg-rain text-white" : "self-start rounded-bl-md bg-paper-2")}
                >
                  {m.text}
                </p>
              ))}
            </div>
            <div className="mx-4 mb-9 rounded-full border border-rule px-5 py-2.5 text-muted-foreground" aria-hidden>
              Text message
            </div>
          </div>
        </div>
        <div className="device-stripe" />
        <div className="device-header" />
        <div className="device-sensors" />
        <div className="device-btns" />
        <div className="device-power" />
      </div>
    </div>
  )
}

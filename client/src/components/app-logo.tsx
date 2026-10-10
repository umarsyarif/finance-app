import { appConfig } from "@/config/app"

export function AppLogo(props: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className='flex items-center gap-2' {...props}>
            <img src="/favicon.svg" alt="" className='size-7' />
            <span className="font-semibold text-nowrap">{appConfig.name}</span>
        </div>
    )
}

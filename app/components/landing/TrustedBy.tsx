import {
  VercelLogo,
  SupabaseLogo,
  NotionLogo,
  FigmaLogo,
  ClockLogo,
  RaycastLogo,
} from './Icons';

export function TrustedBy() {
  const logos = [
    { Logo: VercelLogo, name: 'Vercel' },
    { Logo: SupabaseLogo, name: 'Supabase' },
    { Logo: NotionLogo, name: 'Notion' },
    { Logo: FigmaLogo, name: 'Figma' },
    { Logo: ClockLogo, name: 'Clock' },
    { Logo: RaycastLogo, name: 'Raycast' },
  ];

  return (
    <section className="py-16 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-muted-foreground text-sm font-medium mb-8">
          Trusted by forward-thinking teams at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {logos.map(({ Logo, name }) => (
            <div
              key={name}
              className="opacity-40 hover:opacity-100 transition-opacity duration-300 cursor-pointer"
            >
              <div className="h-8 flex items-center justify-center text-foreground">
                <Logo />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


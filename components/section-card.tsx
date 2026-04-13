type SectionCardProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  action,
  children,
}: SectionCardProps) {
  return (
    <section className="card card-pad">
      <div className="card-header">
        <div>
          <h2 className="card-title">{title}</h2>
          {description ? <p className="card-description">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

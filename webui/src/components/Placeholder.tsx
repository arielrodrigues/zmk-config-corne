type Props = { title: string };

export function Placeholder({ title }: Props) {
  return <div className="placeholder">{title}</div>;
}

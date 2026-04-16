/**
 * Linkify utility to detect and convert URLs and email addresses to clickable links
 */

interface LinkifyProps {
  text: string;
}

export const Linkify = ({ text }: LinkifyProps) => {
  const urlRegex = /^(https?:\/\/[^\s]+|www\.[^\s]+)$/i;
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+$/;
  const parts = text.split(/(\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+|[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
  
  return (
    <>
      {parts.map((part, index) => {
        if (urlRegex.test(part)) {
          const trailing = part.match(/[.,!?;:)]+$/)?.[0] || "";
          const cleanUrl = trailing ? part.slice(0, -trailing.length) : part;
          const href = cleanUrl.startsWith("www.") ? `https://${cleanUrl}` : cleanUrl;
          return (
            <span key={index}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:bg-primary/15 hover:decoration-primary break-all"
              >
                {cleanUrl}
              </a>
              {trailing}
            </span>
          );
        }
        
        if (emailRegex.test(part)) {
          return (
            <a
              key={index}
              href={`mailto:${part}`}
              className="inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:bg-primary/15 hover:decoration-primary break-all"
            >
              {part}
            </a>
          );
        }
        
        return <span key={index}>{part}</span>;
      })}
    </>
  );
};

/**
 * Convert plain text with links to JSX with clickable links
 * Preserves line breaks and whitespace
 */
export const linkifyText = (text: string): JSX.Element => {
  // Split by line breaks first
  const lines = text.split('\n');
  
  return (
    <>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex}>
          <Linkify text={line} />
          {lineIndex < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
};

import { Star } from 'lucide-react';

interface EstrellasInputProps {
  valor: number;
  onChange: (valor: number) => void;
}

export function EstrellasInput({ valor, onChange }: EstrellasInputProps) {
  return (
    <div className="flex items-center gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="transition">
          <Star
            className={`w-8 h-8 ${n <= valor ? 'fill-brand-yellow text-brand-yellow' : 'text-gray-600'}`}
          />
        </button>
      ))}
    </div>
  );
}

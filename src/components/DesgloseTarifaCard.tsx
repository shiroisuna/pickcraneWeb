interface DesgloseTarifaCardProps {
  base: number;
  comision: number;
  total: number;
}

export function DesgloseTarifaCard({ base, comision, total }: DesgloseTarifaCardProps) {
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center justify-between text-gray-400">
        <span>Tarifa base:</span>
        <span>${base.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between text-gray-400">
        <span>Comisión app (1.5%):</span>
        <span>${comision.toFixed(2)}</span>
      </div>
      <hr className="border-gray-700" />
      <div className="flex items-center justify-between text-base">
        <span className="text-gray-300 font-medium">Total a pagar:</span>
        <span className="font-bold text-brand-yellow text-lg">${total.toFixed(2)}</span>
      </div>
    </div>
  );
}

import simboloAzul from "../assets/simbolo-azul.png";
import simboloPrata from "../assets/simbolo-prata.png";

/** Logo oficial da Vertente. `sobreEscuro` usa a versão prata (menu marinho, tema escuro). */
export function Marca({ compacta = false, sobreEscuro = false }: { compacta?: boolean; sobreEscuro?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {sobreEscuro ? (
        <img src={simboloPrata} alt="" width={34} height={34} className="h-[34px] w-[34px] object-contain" />
      ) : (
        <>
          <img src={simboloAzul} alt="" width={32} height={32} className="h-8 w-8 object-contain dark-oculto" />
          <img src={simboloPrata} alt="" width={32} height={32} className="h-8 w-8 object-contain claro-oculto" />
        </>
      )}
      {!compacta && (
        <div className="leading-none">
          <div className="font-display text-[16px] font-bold tracking-[0.14em]">VERTENTE</div>
          <div className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.32em] text-muted">Digital · Sistema</div>
        </div>
      )}
    </div>
  );
}

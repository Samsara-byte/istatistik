import PivotDestekTable from "./PivotDestekTable";

export default function FarkPrimTable() {
  return (
    <PivotDestekTable
      endpoint="fark-prim"
      title="Fark/Prim Ödemeleri"
      nameKey="kategori"
      nameLabel="Kategori"
      excelSheet="Fark-Prim"
      excelFile="fark_prim"
      showSearch={false}
    />
  );
}

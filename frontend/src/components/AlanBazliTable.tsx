import PivotDestekTable from "./PivotDestekTable";

export default function AlanBazliTable() {
  return (
    <PivotDestekTable
      endpoint="alan-bazli"
      title="Alan Bazlı Destekler"
      excelSheet="Alan Bazlı Destekler"
      excelFile="alan_bazli_destek"
    />
  );
}

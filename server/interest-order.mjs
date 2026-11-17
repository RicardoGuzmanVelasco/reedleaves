// Canonical display order for the app's interest catalog. Unknown interests follow
// the established ones in their original order until they receive a position here.
const interestOrder=["personal-growth","communication","society","leadership","productivity","software","finance","psychology","health","mindfulness","metaphysics"];
const rank=new Map(interestOrder.map((id,index)=>[id,index]));

export function orderInterests(interests) {
  return [...interests].sort((a,b)=>(rank.get(a.id)??interestOrder.length)-(rank.get(b.id)??interestOrder.length));
}

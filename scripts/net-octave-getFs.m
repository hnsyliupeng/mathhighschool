function [Fs, Js] = getFs(rodParams, sElement)
% Algebraically equivalent sparse vectorized assembly for rod_network/case_1.
% The original stretchingForce.m is retained as the source of each local law;
% this expression batches that same 6-DOF gradient and Hessian over all edges.
% Validate this optimization against the unmodified source assembly before use.
nd=rodParams.ndof;
ids=reshape([sElement.globalIndex],6,[])';
pairs=reshape([sElement.nodeIndex],2,[])';
L0=[sElement.refLen]'; EA=[sElement.EA_local]';
X=reshape(rodParams.x,3,[])';
delta=X(pairs(:,2),:)-X(pairs(:,1),:);
L=sqrt(sum(delta.*delta,2));
t=delta./L;
force=EA.*(L./L0-1);
local=[-t.*force,t.*force];
Fs=-full(sparse(ids(:),ones(numel(ids),1),local(:),nd,1));
alpha=EA.*(1./L0-1./L); beta=EA./L;
I=[];J=[];V=[];
for a=1:3
  for b=1:3
    block=beta.*t(:,a).*t(:,b);
    if a==b, block=block+alpha; end
    I=[I;ids(:,a);ids(:,a+3);ids(:,a);ids(:,a+3)];
    J=[J;ids(:,b);ids(:,b+3);ids(:,b+3);ids(:,b)];
    V=[V;-block;-block;block;block];
  end
end
Js=sparse(I,J,V,nd,nd);
end

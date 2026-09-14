import {useId} from 'react';

export default function InkPreview({src,color,label}){
 const filterId=`ink-${useId().replace(/:/g,'')}`;
 if(!src)return <p>Preview unavailable</p>;
 return <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
  <defs><filter id={filterId} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1" result="luminance"/><feComposite in="luminance" in2="SourceAlpha" operator="in" result="ink"/><feFlood floodColor={color}/><feComposite operator="in" in2="ink"/></filter></defs>
  <image href={src} width="100" height="100" preserveAspectRatio="xMidYMid meet" filter={`url(#${filterId})`}/>
 </svg>
}

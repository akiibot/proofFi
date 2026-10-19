import {forwardRef,type ComponentProps} from 'react';
import {navigate} from './router';
export default forwardRef<HTMLAnchorElement,ComponentProps<'a'> & {href:string}>(function Link({href,onClick,...props},ref){
 return <a {...props} ref={ref} href={href.startsWith('/')?'#'+href:href} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&href.startsWith('/')&&!event.ctrlKey&&!event.metaKey){event.preventDefault();navigate(href);}}}/>;
});
